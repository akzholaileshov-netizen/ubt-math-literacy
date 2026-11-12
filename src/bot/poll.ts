import { botCommands } from './copy';
import { reduce, reduceTimeout, type ArmTimer, type Outgoing, type ReduceResult } from './handle';
import { createSessionStore } from './session';
import { redactSecret } from './token';
import { incomingFromUpdate, type TelegramUpdate } from './updates';
import type { Lang } from '../types';

const API_ROOT = 'https://api.telegram.org';
const LONG_POLL_SECONDS = 30;
const CLIENT_TIMEOUT_MS = 40_000;

export class TelegramError extends Error {
  readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'TelegramError';
    this.code = code;
  }
}

type ApiOk<T> = { ok: true; result: T };
type ApiErr = {
  ok: false;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

export async function runBot(token: string, signal?: AbortSignal): Promise<void> {
  await api(token, 'deleteWebhook', { drop_pending_updates: false }, signal);
  try {
    await api(token, 'setMyCommands', { commands: commandPayload('kk') }, signal);
    await api(token, 'setMyCommands', { commands: commandPayload('kk'), language_code: 'kk' }, signal);
    await api(token, 'setMyCommands', { commands: commandPayload('ru'), language_code: 'ru' }, signal);
  } catch (error) {
    if (error instanceof TelegramError && error.code === 401) throw error;
    console.error(errorText(error, token));
  }
  console.log('Telegram bot is polling. Send /start in a private chat.');

  const sessions = createSessionStore();
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const tails = new Map<number, Promise<void>>();
  let offset = 0;

  const enqueue = (chatId: number, task: () => Promise<void>): Promise<void> => {
    const previous = tails.get(chatId) ?? Promise.resolve();
    const run = previous.then(task, task);
    tails.set(
      chatId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  };

  const disarm = (chatId: number) => {
    const existing = timers.get(chatId);
    if (existing !== undefined) clearTimeout(existing);
    timers.delete(chatId);
  };

  const schedule = (arm: ArmTimer) => {
    disarm(arm.chatId);
    const delay = Math.min(2_147_483_647, Math.max(0, arm.fireAt - Date.now()));
    const handle = setTimeout(() => {
      if (timers.get(arm.chatId) !== handle) return;
      if (Date.now() < arm.fireAt) {
        schedule(arm);
        return;
      }
      timers.delete(arm.chatId);
      void enqueue(arm.chatId, async () => {
        const result = reduceTimeout(sessions, arm, Date.now());
        await emit(result);
      }).catch((error: unknown) => {
        console.error(errorText(error, token));
      });
    }, delay);
    timers.set(arm.chatId, handle);
  };

  const emit = async (result: ReduceResult) => {
    if (result.clearTimer) disarm(result.chatId);
    try {
      for (const item of result.outgoing) {
        await deliver(token, item, signal);
      }
    } finally {
      if (result.arm) schedule(result.arm);
    }
  };

  while (!signal?.aborted) {
    let updates: TelegramUpdate[];
    try {
      updates = await api<TelegramUpdate[]>(
        token,
        'getUpdates',
        { offset, timeout: LONG_POLL_SECONDS, allowed_updates: ['message', 'callback_query'] },
        signal,
      );
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        if (signal?.aborted) break;
        continue;
      }
      if (error instanceof TelegramError && error.code === 401) throw error;
      if (error instanceof TelegramError && error.code === 409) {
        console.error('Another poller is already using this token. Stop the other process.');
        await delay(5000, signal);
        continue;
      }
      console.error(errorText(error, token));
      await delay(2000, signal);
      continue;
    }
    if (!Array.isArray(updates)) {
      await delay(1000, signal);
      continue;
    }
    for (const update of updates) {
      if (signal?.aborted) return;
      if (typeof update?.update_id !== 'number') continue;
      offset = update.update_id + 1;
      const incoming = incomingFromUpdate(update);
      if (!incoming) continue;
      try {
        await enqueue(incoming.chatId, async () => {
          const result = reduce(sessions, incoming, Date.now());
          await emit(result);
        });
      } catch (error) {
        if (error instanceof TelegramError && error.code === 401) throw error;
        console.error(errorText(error, token));
      }
    }
  }
}

function commandPayload(lang: Lang): { command: string; description: string }[] {
  return botCommands[lang].map((command) => ({ command: command.command, description: command.description }));
}

async function deliver(token: string, item: Outgoing, signal?: AbortSignal): Promise<void> {
  try {
    await sendOnce(token, item, signal);
  } catch (error) {
    if (signal?.aborted || (error instanceof TelegramError && error.code === 401)) throw error;
    await delay(500, signal);
    await sendOnce(token, item, signal);
  }
}

async function sendOnce(token: string, item: Outgoing, signal?: AbortSignal): Promise<void> {
  if (item.kind === 'toast') {
    const body: Record<string, unknown> = { callback_query_id: item.callbackId };
    if (item.text) body.text = item.text.slice(0, 200);
    await api(token, 'answerCallbackQuery', body, signal);
    return;
  }
  const text = item.text.length > 4096 ? `${item.text.slice(0, 4095)}…` : item.text;
  if (!text.trim()) return;
  const body: Record<string, unknown> = {
    chat_id: item.chatId,
    text,
    link_preview_options: { is_disabled: true },
  };
  if (item.keyboard) {
    body.reply_markup = {
      inline_keyboard: item.keyboard.map((row) =>
        row.map((button) => ({ text: button.text, callback_data: button.data })),
      ),
    };
  }
  await api(token, 'sendMessage', body, signal);
}

async function api<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  allowRetry = true,
): Promise<T> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(`${API_ROOT}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload: ApiOk<T> | ApiErr;
    try {
      payload = (await response.json()) as ApiOk<T> | ApiErr;
    } catch {
      throw new TelegramError(`Telegram ${method} returned a response that was not JSON`, response.status);
    }
    if (!payload.ok) {
      if (payload.error_code === 429 && allowRetry) {
        const retryAfter = payload.parameters?.retry_after;
        const seconds = typeof retryAfter === 'number' && Number.isFinite(retryAfter) ? retryAfter : 1;
        await delay(Math.min(Math.max(seconds, 1), 30) * 1000, signal);
        return api(token, method, body, signal, false);
      }
      const description = payload.description ?? 'request failed';
      throw new TelegramError(`Telegram ${method} failed: ${description}`, payload.error_code);
    }
    return payload.result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

function abortError(): Error {
  const error = new Error('This operation was aborted');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function errorText(error: unknown, token: string): string {
  const message = error instanceof Error ? error.message : 'Telegram request failed';
  return redactSecret(message, token);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
