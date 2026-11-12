import { describe, expect, it } from 'vitest';
import { questionsBySection, sections } from '../data/catalog';
import { formatClock, QUESTION_SECONDS } from '../quiz/time';
import { reduce, reduceTimeout, type ReduceResult } from './handle';
import { activeQuestion, createSessionStore, summarize, type SessionStore } from './session';
import { choiceFromText, commandName, incomingFromUpdate } from './updates';

const CHAT = 42;

function texts(result: ReduceResult): string[] {
  return result.outgoing.filter((item) => item.kind === 'message').map((item) => item.text);
}

function startKazakh(store: SessionStore): ReduceResult {
  reduce(store, { type: 'command', chatId: CHAT, command: 'start' }, 0);
  return reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'lang', data: 'l:kk' }, 0);
}

describe('telegram updates', () => {
  it('parses private commands and ignores groups', () => {
    expect(commandName('/start@QuizBot')).toBe('start');
    expect(choiceFromText('B)')).toBe(1);
    expect(choiceFromText('d.')).toBe(3);
    expect(choiceFromText('hello')).toBeNull();
    expect(choiceFromText('А')).toBeNull();
    expect(
      incomingFromUpdate({
        update_id: 1,
        message: { chat: { id: 5, type: 'group' }, text: '/start' },
      }),
    ).toBeNull();
    expect(
      incomingFromUpdate({
        update_id: 2,
        message: { chat: { id: 5, type: 'private' }, text: '/language' },
      }),
    ).toEqual({ type: 'command', chatId: 5, command: 'language' });
    expect(
      incomingFromUpdate({
        update_id: 3,
        callback_query: {
          id: 'cb',
          data: 's:numbers',
          message: { chat: { id: 5, type: 'private' } },
        },
      }),
    ).toEqual({ type: 'callback', chatId: 5, callbackId: 'cb', data: 's:numbers' });
  });
});

describe('telegram session flow', () => {
  it('asks for a language, then lists every section', () => {
    const store = createSessionStore();
    const welcome = reduce(store, { type: 'command', chatId: CHAT, command: 'start' }, 0);
    expect(texts(welcome).join('\n')).toContain('Тілді таңдаңыз');
    expect(texts(welcome).join('\n')).toContain('Выберите язык');
    const menu = startKazakh(store);
    const data = menu.outgoing.flatMap((item) => (item.kind === 'message' ? (item.keyboard ?? []) : [])).flat();
    expect(data.map((button) => button.data)).toEqual([...sections.map((section) => `s:${section.id}`), 'lang']);
    expect(store.get(CHAT).lang).toBe('kk');
    expect(store.get(CHAT).phase).toBe('menu');
  });

  it('keeps a separate session per chat', () => {
    const store = createSessionStore();
    reduce(store, { type: 'command', chatId: 1, command: 'start' }, 0);
    reduce(store, { type: 'callback', chatId: 1, callbackId: 'a', data: 'l:ru' }, 0);
    reduce(store, { type: 'command', chatId: 2, command: 'start' }, 0);
    expect(store.get(1).lang).toBe('ru');
    expect(store.get(2).lang).toBeNull();
  });

  it('shows the catalog prompt and scores the stored clock', () => {
    const store = createSessionStore();
    startKazakh(store);
    const opened = reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:numbers' }, 1_000);
    const first = questionsBySection.numbers[0];
    expect(texts(opened).join('\n')).toContain(first.prompt.kk);
    expect(texts(opened).join('\n')).not.toContain(first.solution.kk);
    expect(opened.arm).toEqual({
      chatId: CHAT,
      sectionId: 'numbers',
      index: 0,
      startedAt: 1_000,
      fireAt: 1_000 + QUESTION_SECONDS * 1000,
    });
    expect(opened.clearTimer).toBe(true);

    const answered = reduce(
      store,
      { type: 'callback', chatId: CHAT, callbackId: 'ans', data: `a:0:${first.correctIndex}` },
      61_000,
    );
    expect(store.get(CHAT).answers[0].points).toBe(18);
    expect(store.get(CHAT).index).toBe(1);
    expect(store.get(CHAT).questionStartedAt).toBe(61_000);
    const body = texts(answered);
    expect(body[0]).toContain('+18');
    expect(body[0]).toContain(formatClock(240));
    expect(body[1]).toContain(questionsBySection.numbers[1].prompt.kk);
    expect(body[1]).not.toContain(questionsBySection.numbers[1].solution.kk);
    expect(answered.arm?.startedAt).toBe(61_000);
    expect(answered.clearTimer).toBe(true);
  });

  it('accepts a letter, ignores prose, and rejects a stale button', () => {
    const store = createSessionStore();
    startKazakh(store);
    reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:word' }, 2_000);
    const question = questionsBySection.word[0];
    const letter = 'ABCD'[question.correctIndex];
    const typed = reduce(store, { type: 'text', chatId: CHAT, text: `${letter})` }, 2_000);
    expect(store.get(CHAT).answers[0].points).toBe(20);
    expect(texts(typed).join('\n')).toContain(questionsBySection.word[1].prompt.kk);

    const prose = reduce(store, { type: 'text', chatId: CHAT, text: '12' }, 3_000);
    expect(store.get(CHAT).index).toBe(1);
    expect(store.get(CHAT).questionStartedAt).toBe(2_000);
    expect(prose.clearTimer).toBe(false);
    expect(texts(prose).join('\n')).toContain(questionsBySection.word[1].prompt.kk);

    const stale = reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'old', data: 'a:0:0' }, 4_000);
    expect(stale.clearTimer).toBe(false);
    expect(stale.arm).toBeNull();
    expect(store.get(CHAT).index).toBe(1);
    expect(texts(stale)).toEqual([]);
    expect(stale.outgoing[0]).toMatchObject({ kind: 'toast' });
  });

  it('shows a hint without moving the clock', () => {
    const store = createSessionStore();
    startKazakh(store);
    reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:logic' }, 5_000);
    const question = questionsBySection.logic[0];
    const hint = reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'h', data: 'h:0' }, 6_000);
    expect(hint.clearTimer).toBe(false);
    expect(store.get(CHAT).questionStartedAt).toBe(5_000);
    expect(store.get(CHAT).answers).toEqual([]);
    expect(texts(hint).join('\n')).toContain(question.hint.kk);
    expect(texts(hint).join('\n')).not.toContain(question.solution.kk);
  });

  it('switches language without restarting the clock', () => {
    const store = createSessionStore();
    startKazakh(store);
    reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:charts' }, 7_000);
    const switched = reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'ru', data: 'l:ru' }, 8_000);
    expect(switched.clearTimer).toBe(false);
    expect(switched.arm).toBeNull();
    expect(store.get(CHAT).lang).toBe('ru');
    expect(store.get(CHAT).questionStartedAt).toBe(7_000);
    expect(texts(switched).join('\n')).toContain(questionsBySection.charts[0].prompt.ru);
    expect(texts(switched).join('\n')).toContain('12');
  });

  it('expires the stored clock for zero points and opens the next question', () => {
    const store = createSessionStore();
    startKazakh(store);
    const opened = reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:numbers' }, 1_000);
    const expired = reduceTimeout(store, opened.arm!, 1_000 + QUESTION_SECONDS * 1000);
    expect(store.get(CHAT).answers[0]).toMatchObject({ timedOut: true, points: 0, correct: false, selectedIndex: null });
    expect(store.get(CHAT).index).toBe(1);
    expect(texts(expired).join('\n')).toContain('Уақыт бітті');
    expect(texts(expired).join('\n')).toContain(questionsBySection.numbers[1].prompt.kk);
    expect(expired.arm?.index).toBe(1);
    const ignored = reduceTimeout(store, opened.arm!, 1_000 + QUESTION_SECONDS * 1000);
    expect(ignored.outgoing).toEqual([]);
    expect(ignored.clearTimer).toBe(false);
    expect(store.get(CHAT).index).toBe(1);
  });

  it('stops a quiz with the points so far and clears the clock', () => {
    const store = createSessionStore();
    startKazakh(store);
    reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:geometry' }, 1_000);
    const question = activeQuestion(store.get(CHAT))!;
    reduce(store, { type: 'text', chatId: CHAT, text: 'ABCD'[question.correctIndex] }, 1_000);
    const stopped = reduce(store, { type: 'command', chatId: CHAT, command: 'stop' }, 2_000);
    expect(stopped.clearTimer).toBe(true);
    expect(stopped.arm).toBeNull();
    expect(store.get(CHAT).phase).toBe('menu');
    expect(store.get(CHAT).questionStartedAt).toBeNull();
    expect(texts(stopped).join('\n')).toContain('1/30');
    expect(texts(stopped).join('\n')).toContain('20');
  });

  it('finishes a section at 600 and can retry it', () => {
    const store = createSessionStore();
    startKazakh(store);
    reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'open', data: 's:logic' }, 10_000);
    let now = 10_000;
    let last: ReduceResult | null = null;
    for (let index = 0; index < 30; index += 1) {
      const question = activeQuestion(store.get(CHAT));
      expect(question?.id).toBe(questionsBySection.logic[index].id);
      last = reduce(
        store,
        { type: 'callback', chatId: CHAT, callbackId: `a${index}`, data: `a:${index}:${question!.correctIndex}` },
        now,
      );
      now = store.get(CHAT).questionStartedAt ?? now;
    }
    expect(store.get(CHAT).phase).toBe('summary');
    expect(summarize(store.get(CHAT)).points).toBe(600);
    expect(texts(last!).join('\n')).toContain('600');
    expect(last?.arm).toBeNull();
    const retry = reduce(store, { type: 'callback', chatId: CHAT, callbackId: 'retry', data: 'r' }, 80_000);
    expect(store.get(CHAT).phase).toBe('question');
    expect(store.get(CHAT).index).toBe(0);
    expect(store.get(CHAT).answers).toEqual([]);
    expect(store.get(CHAT).questionStartedAt).toBe(80_000);
    expect(texts(retry).join('\n')).toContain(questionsBySection.logic[0].prompt.kk);
    expect(retry.arm?.startedAt).toBe(80_000);
  });
});
