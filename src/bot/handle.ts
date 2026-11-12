import type { Lang } from '../types';
import { copy } from './copy';
import {
  feedbackMessage,
  fitTelegramText,
  helpMessage,
  hintMessage,
  languageKeyboard,
  languagePrompt,
  screenFor,
  sectionKeyboard,
  summaryMessage,
  type Keyboard,
} from './format';
import { questionDeadline } from './score';
import {
  activeQuestion,
  beginSection,
  chooseLanguage,
  expireQuestion,
  leaveQuiz,
  submitAnswer,
  type Session,
  type SessionStore,
} from './session';
import { choiceFromText, type Incoming } from './updates';

export type Outgoing =
  | { kind: 'message'; chatId: number; text: string; keyboard?: Keyboard }
  | { kind: 'toast'; callbackId: string; text?: string };

export type ArmTimer = {
  chatId: number;
  sectionId: string;
  index: number;
  startedAt: number;
  fireAt: number;
};

export type ReduceResult = {
  chatId: number;
  outgoing: Outgoing[];
  arm: ArmTimer | null;
  clearTimer: boolean;
};

export function reduce(store: SessionStore, incoming: Incoming, now: number): ReduceResult {
  const session = store.get(incoming.chatId);
  if (incoming.type === 'command') return onCommand(store, session, incoming);
  if (incoming.type === 'callback') return onCallback(store, session, incoming, now);
  return onText(store, session, incoming, now);
}

export function reduceTimeout(store: SessionStore, arm: ArmTimer, now: number): ReduceResult {
  const session = store.get(arm.chatId);
  const step = expireQuestion(session, arm.index, arm.startedAt, now);
  if (!step.ok) return { chatId: arm.chatId, outgoing: [], arm: null, clearTimer: false };
  return gradedResult(store, arm.chatId, step);
}

function onCommand(
  store: SessionStore,
  session: Session,
  incoming: Extract<Incoming, { type: 'command' }>,
): ReduceResult {
  const command = incoming.command === 'lang' ? 'language' : incoming.command;
  if (command === 'help') return say(incoming.chatId, helpMessage(session.lang));
  if (command === 'language') return say(incoming.chatId, languageAsk(session), languageKeyboard());
  if (command === 'start' || command === 'sections' || command === 'stop') {
    return menuResult(store, incoming.chatId, session);
  }
  return say(incoming.chatId, helpMessage(session.lang));
}

function onText(
  store: SessionStore,
  session: Session,
  incoming: Extract<Incoming, { type: 'text' }>,
  now: number,
): ReduceResult {
  if (!session.lang || session.phase === 'pick-language') {
    const screen = screenFor(session);
    return say(incoming.chatId, screen.text, screen.keyboard);
  }
  if (session.phase === 'question') {
    const choice = choiceFromText(incoming.text);
    if (choice === null) {
      const screen = screenFor(session);
      return {
        chatId: incoming.chatId,
        outgoing: [
          { kind: 'message', chatId: incoming.chatId, text: copy[session.lang].useButtons },
          { kind: 'message', chatId: incoming.chatId, text: screen.text, keyboard: screen.keyboard },
        ],
        arm: null,
        clearTimer: false,
      };
    }
    const step = submitAnswer(session, session.index, choice, now);
    if (!step.ok) return say(incoming.chatId, copy[session.lang].useButtons);
    return gradedResult(store, incoming.chatId, step);
  }
  const screen = screenFor(session);
  return say(incoming.chatId, screen.text, screen.keyboard);
}

function onCallback(
  store: SessionStore,
  session: Session,
  incoming: Extract<Incoming, { type: 'callback' }>,
  now: number,
): ReduceResult {
  const { chatId, callbackId, data } = incoming;
  const langPick = data === 'l:kk' ? 'kk' : data === 'l:ru' ? 'ru' : null;
  if (data === 'lang') {
    return withToast(callbackId, say(chatId, languageAsk(session), languageKeyboard()));
  }
  if (langPick) {
    const next = chooseLanguage(session, langPick);
    store.set(chatId, next);
    const screen = screenFor(next);
    return withToast(callbackId, {
      chatId,
      outgoing: [{ kind: 'message', chatId, text: screen.text, keyboard: screen.keyboard }],
      arm: null,
      clearTimer: false,
    });
  }
  if (data === 'm') return withToast(callbackId, menuResult(store, chatId, session));
  if (data === 'r') return withToast(callbackId, retry(store, session, chatId, now));
  const section = /^s:([a-z]+)$/.exec(data);
  if (section?.[1]) return withToast(callbackId, openSection(store, session, chatId, section[1], now));
  const hint = /^h:(\d+)$/.exec(data);
  if (hint) return showHint(session, chatId, callbackId, Number(hint[1]));
  const answer = /^a:(\d+):([0-3])$/.exec(data);
  if (answer) {
    const choice = Number(answer[2]) as 0 | 1 | 2 | 3;
    const step = submitAnswer(session, Number(answer[1]), choice, now);
    if (!step.ok) return stale(chatId, callbackId, session.lang);
    return gradedResult(store, chatId, step, callbackId);
  }
  return stale(chatId, callbackId, session.lang);
}

function openSection(
  store: SessionStore,
  session: Session,
  chatId: number,
  sectionId: string,
  now: number,
): ReduceResult {
  if (!session.lang) return say(chatId, languageAsk(session), languageKeyboard());
  const next = beginSection(session, sectionId, now);
  if (!next) return say(chatId, copy[session.lang].unknownSection, sectionKeyboard(session.lang));
  store.set(chatId, next);
  const screen = screenFor(next);
  const parts: string[] = [];
  if (session.phase === 'question' && session.lang && session.answers.length > 0) {
    parts.push(summaryMessage(session), copy[session.lang].stopped);
  }
  parts.push(screen.text);
  return {
    chatId,
    outgoing: [
      {
        kind: 'message',
        chatId,
        text: fitTelegramText(parts.join('\n\n')),
        keyboard: screen.keyboard,
      },
    ],
    arm: armFor(chatId, next),
    clearTimer: true,
  };
}

function retry(store: SessionStore, session: Session, chatId: number, now: number): ReduceResult {
  if (!session.sectionId) return menuResult(store, chatId, session);
  return openSection(store, session, chatId, session.sectionId, now);
}

function showHint(session: Session, chatId: number, callbackId: string, index: number): ReduceResult {
  const question = activeQuestion(session);
  if (session.phase !== 'question' || session.index !== index || !question || !session.lang) {
    return stale(chatId, callbackId, session.lang);
  }
  return withToast(callbackId, {
    chatId,
    outgoing: [{ kind: 'message', chatId, text: hintMessage(session.lang, question) }],
    arm: null,
    clearTimer: false,
  });
}

function menuResult(store: SessionStore, chatId: number, session: Session): ReduceResult {
  const inQuestion = session.phase === 'question';
  const parts: string[] = [];
  if (inQuestion && session.lang && session.answers.length > 0) parts.push(summaryMessage(session));
  if (inQuestion && session.lang) parts.push(copy[session.lang].stopped);
  const next = leaveQuiz(session);
  store.set(chatId, next);
  const screen = screenFor(next);
  parts.push(screen.text);
  return {
    chatId,
    outgoing: [
      {
        kind: 'message',
        chatId,
        text: fitTelegramText(parts.join('\n\n')),
        keyboard: screen.keyboard,
      },
    ],
    arm: null,
    clearTimer: inQuestion,
  };
}

function gradedResult(
  store: SessionStore,
  chatId: number,
  step: Extract<ReturnType<typeof submitAnswer>, { ok: true }>,
  callbackId?: string,
): ReduceResult {
  store.set(chatId, step.session);
  const language = step.session.lang;
  const outgoing: Outgoing[] = [];
  if (callbackId) {
    outgoing.push({
      kind: 'toast',
      callbackId,
      text: language ? toastFor(language, step.answer) : undefined,
    });
  }
  if (language) {
    outgoing.push({
      kind: 'message',
      chatId,
      text: feedbackMessage(language, step.question, step.answer),
    });
  }
  const screen = screenFor(step.session);
  outgoing.push({ kind: 'message', chatId, text: screen.text, keyboard: screen.keyboard });
  return {
    chatId,
    outgoing,
    arm: armFor(chatId, step.session),
    clearTimer: true,
  };
}

function armFor(chatId: number, session: Session): ArmTimer | null {
  if (session.phase !== 'question' || session.questionStartedAt == null || !session.sectionId) return null;
  return {
    chatId,
    sectionId: session.sectionId,
    index: session.index,
    startedAt: session.questionStartedAt,
    fireAt: questionDeadline(session.questionStartedAt),
  };
}

function toastFor(lang: Lang, answer: { timedOut: boolean; correct: boolean }): string {
  if (answer.timedOut) return copy[lang].timeoutToast;
  if (answer.correct) return copy[lang].correctToast;
  return copy[lang].wrongToast;
}

function stale(chatId: number, callbackId: string, lang: Lang | null): ReduceResult {
  const text = lang ? copy[lang].stale : `${copy.kk.stale} / ${copy.ru.stale}`;
  return { chatId, outgoing: [{ kind: 'toast', callbackId, text }], arm: null, clearTimer: false };
}

function languageAsk(session: Session): string {
  if (!session.lang) return languagePrompt(null);
  return copy[session.lang].pickLanguage;
}

function say(chatId: number, text: string, keyboard?: Keyboard): ReduceResult {
  return {
    chatId,
    outgoing: [{ kind: 'message', chatId, text, keyboard }],
    arm: null,
    clearTimer: false,
  };
}

function withToast(callbackId: string, result: ReduceResult): ReduceResult {
  return {
    ...result,
    outgoing: [{ kind: 'toast', callbackId }, ...result.outgoing],
  };
}
