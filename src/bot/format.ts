import { findSection, questionsBySection, sections } from '../data/catalog';
import { messages } from '../i18n/messages';
import { formatClock, formatDuration, QUESTION_SECONDS } from '../quiz/time';
import type { Lang, Question, Visual } from '../types';
import { botCommands, copy } from './copy';
import { activeQuestion, bankSize, summarize, type Session } from './session';

export const TELEGRAM_TEXT_LIMIT = 4096;

export type Button = { text: string; data: string };
export type Keyboard = Button[][];

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function fitTelegramText(text: string): string {
  if (text.length <= TELEGRAM_TEXT_LIMIT) return text;
  return `${text.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
}

export function languageKeyboard(): Keyboard {
  return [
    [
      { text: 'Қазақша', data: 'l:kk' },
      { text: 'Русский', data: 'l:ru' },
    ],
  ];
}

export function sectionKeyboard(lang: Lang): Keyboard {
  return [
    ...sections.map((section) => [{ text: section.title[lang], data: `s:${section.id}` }]),
    [{ text: copy[lang].language, data: 'lang' }],
  ];
}

export function answerKeyboard(index: number, lang: Lang): Keyboard {
  return [
    OPTION_LETTERS.map((letter, choice) => ({ text: letter, data: `a:${index}:${choice}` })),
    [{ text: copy[lang].hint, data: `h:${index}` }],
  ];
}

export function summaryKeyboard(lang: Lang): Keyboard {
  return [
    [
      { text: copy[lang].sections, data: 'm' },
      { text: copy[lang].retry, data: 'r' },
    ],
  ];
}

export function languagePrompt(lang: Lang | null): string {
  if (!lang) {
    return fitTelegramText(
      `${messages.kk.brand} · ${messages.kk.eyebrow}\n${messages.ru.brand} · ${messages.ru.eyebrow}\n\n${copy.kk.pickLanguage} / ${copy.ru.pickLanguage}`,
    );
  }
  return fitTelegramText(`${messages[lang].brand} · ${messages[lang].eyebrow}\n\n${copy[lang].pickLanguage}`);
}

export function menuMessage(lang: Lang): string {
  return fitTelegramText(`${messages[lang].brand} · ${messages[lang].eyebrow}\n\n${copy[lang].menu(bankSize())}`);
}

export function helpMessage(lang: Lang | null): string {
  if (!lang) {
    return fitTelegramText(`${helpMessage('kk')}\n\n${helpMessage('ru')}`);
  }
  const commands = botCommands[lang].map((command) => `/${command.command} — ${command.description}`).join('\n');
  return fitTelegramText(`${messages[lang].brand}\n\n${copy[lang].helpClock}\n\n${commands}`);
}

export function questionMessage(session: Session): string | null {
  const lang = session.lang;
  const question = activeQuestion(session);
  const section = session.sectionId ? findSection(session.sectionId) : undefined;
  if (!lang || !question || !section) return null;
  const total = questionsBySection[section.id]?.length ?? 0;
  const lines = [
    section.title[lang],
    copy[lang].questionProgress(session.index + 1, total),
    copy[lang].timeAllowance(formatClock(QUESTION_SECONDS)),
    '',
    question.prompt[lang],
  ];
  if (question.visual) lines.push('', formatVisual(question.visual, lang));
  lines.push('');
  question.options.forEach((option, index) => {
    lines.push(`${OPTION_LETTERS[index]}) ${option[lang]}`);
  });
  lines.push('', copy[lang].pickOption);
  return fitTelegramText(lines.join('\n'));
}

export function feedbackMessage(lang: Lang, question: Question, answer: { timedOut: boolean; correct: boolean; points: number; secondsLeft: number }): string {
  const verdict = answer.timedOut
    ? copy[lang].timeout
    : answer.correct
      ? copy[lang].correct(answer.points, formatClock(answer.secondsLeft))
      : copy[lang].wrong;
  const lines = [verdict];
  if (!answer.correct) {
    const letter = OPTION_LETTERS[question.correctIndex];
    lines.push(`${copy[lang].correctAnswer}: ${letter}) ${question.options[question.correctIndex][lang]}`);
  }
  lines.push('', `${copy[lang].solution}:`, question.solution[lang]);
  return fitTelegramText(lines.join('\n'));
}

export function hintMessage(lang: Lang, question: Question): string {
  return fitTelegramText(`${copy[lang].hint}: ${question.hint[lang]}`);
}

export function summaryMessage(session: Session): string {
  const lang = session.lang ?? 'kk';
  const stats = summarize(session);
  const title = session.sectionId ? (findSection(session.sectionId)?.title[lang] ?? '') : '';
  const done = stats.sectionSize > 0 && stats.answered >= stats.sectionSize;
  return fitTelegramText(
    copy[lang].summary({
      ...stats,
      title,
      done,
      duration: formatDuration(stats.timeSpentSeconds),
    }),
  );
}

export function screenFor(session: Session): { text: string; keyboard: Keyboard } {
  if (!session.lang || session.phase === 'pick-language') {
    return { text: languagePrompt(session.lang), keyboard: languageKeyboard() };
  }
  if (session.phase === 'question') {
    const text = questionMessage(session);
    if (!text) return { text: menuMessage(session.lang), keyboard: sectionKeyboard(session.lang) };
    return { text, keyboard: answerKeyboard(session.index, session.lang) };
  }
  if (session.phase === 'summary') {
    return { text: summaryMessage(session), keyboard: summaryKeyboard(session.lang) };
  }
  return { text: menuMessage(session.lang), keyboard: sectionKeyboard(session.lang) };
}

function formatVisual(visual: Visual, lang: Lang): string {
  if (visual.type === 'bar' || visual.type === 'line') {
    const items = visual.type === 'bar' ? visual.items : visual.points;
    const lines = items.map((item) => `${item.label[lang]} - ${item.value}`);
    if (visual.unit) lines.push(visual.unit[lang]);
    return lines.join('\n');
  }
  const header = visual.headers.map((cell) => cell[lang]).join(' | ');
  const rows = visual.rows.map((row) => row.map((cell) => cell[lang]).join(' | '));
  return [header, ...rows].join('\n');
}
