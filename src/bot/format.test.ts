import { describe, expect, it } from 'vitest';
import { questionsBySection, sections } from '../data/catalog';
import { formatClock, QUESTION_SECONDS } from '../quiz/time';
import type { Lang } from '../types';
import { copy } from './copy';
import {
  feedbackMessage,
  menuMessage,
  questionMessage,
  sectionKeyboard,
  summaryMessage,
  TELEGRAM_TEXT_LIMIT,
} from './format';
import { beginSection, blankSession, chooseLanguage, submitAnswer } from './session';

describe('telegram question text', () => {
  it('renders every bank question in both languages inside Telegram limits', () => {
    for (const lang of ['kk', 'ru'] as const) {
      for (const section of sections) {
        const started = beginSection(chooseLanguage(blankSession(), lang), section.id, 0);
        expect(started).not.toBeNull();
        if (!started) continue;
        const questions = questionsBySection[section.id];
        expect(questions).toHaveLength(30);
        for (let index = 0; index < questions.length; index += 1) {
          const question = questions[index];
          const text = questionMessage({ ...started, index });
          expect(text).toBeTruthy();
          expect(text!.length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
          expect(text).toContain(question.prompt[lang]);
          expect(text).toContain(formatClock(QUESTION_SECONDS));
          expect(text).not.toContain(copy[lang].solution);
          question.options.forEach((option, optionIndex) => {
            expect(text).toContain(`${'ABCD'[optionIndex]}) ${option[lang]}`);
          });
          if (question.visual?.type === 'bar' || question.visual?.type === 'line') {
            const items = question.visual.type === 'bar' ? question.visual.items : question.visual.points;
            for (const item of items) {
              expect(text).toContain(`${item.label[lang]} - ${item.value}`);
            }
          }
          if (question.visual?.type === 'table') {
            expect(text).toContain(question.visual.headers.map((cell) => cell[lang]).join(' | '));
            for (const row of question.visual.rows) {
              expect(text).toContain(row.map((cell) => cell[lang]).join(' | '));
            }
          }
          for (const sample of [
            { timedOut: false, correct: true, points: 20, secondsLeft: 300 },
            { timedOut: false, correct: false, points: 0, secondsLeft: 120 },
            { timedOut: true, correct: false, points: 0, secondsLeft: 0 },
          ]) {
            expect(feedbackMessage(lang, question, sample).length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
          }
        }
      }
    }
  });

  it('keeps section buttons inside Telegram limits and points them at catalog ids', () => {
    for (const lang of ['kk', 'ru'] as const) {
      const buttons = sectionKeyboard(lang).flat();
      expect(buttons.map((button) => button.data)).toEqual([...sections.map((section) => `s:${section.id}`), 'lang']);
      for (const button of buttons) {
        expect(button.text.length).toBeLessThanOrEqual(64);
        expect(button.data.length).toBeLessThanOrEqual(64);
      }
      expect(menuMessage(lang)).toContain('600');
      expect(menuMessage(lang).length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
    }
  });

  it('uses Russian point plurals and a Kazakh score line', () => {
    const question = questionsBySection.numbers[0];
    expect(feedbackMessage('ru', question, { timedOut: false, correct: true, points: 1, secondsLeft: 30 })).toContain('+1 очко');
    expect(feedbackMessage('ru', question, { timedOut: false, correct: true, points: 2, secondsLeft: 60 })).toContain('+2 очка');
    expect(feedbackMessage('ru', question, { timedOut: false, correct: true, points: 18, secondsLeft: 240 })).toContain('+18 очков');
    expect(feedbackMessage('kk', question, { timedOut: false, correct: true, points: 18, secondsLeft: 240 })).toContain('+18 ұпай');
    expect(feedbackMessage('kk', question, { timedOut: false, correct: true, points: 18, secondsLeft: 240 })).toContain('4:00');
  });

  it('summarizes a partial attempt and a finished section', () => {
    const langs: Lang[] = ['kk', 'ru'];
    for (const lang of langs) {
      const started = beginSection(chooseLanguage(blankSession(), lang), 'geometry', 1_000)!;
      const step = submitAnswer(started, 0, activeCorrect(started), 1_000);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      const partial = summaryMessage(step.session);
      expect(partial).toContain('1/30');
      expect(partial).toContain('20');
      const finished = { ...step.session, phase: 'summary' as const, answers: Array.from({ length: 30 }, () => step.answer) };
      const full = summaryMessage(finished);
      expect(full).toContain('600');
      expect(full).toContain(lang === 'kk' ? 'Нәтиже' : 'Результат');
    }
  });
});

function activeCorrect(session: NonNullable<ReturnType<typeof beginSection>>): 0 | 1 | 2 | 3 {
  const question = questionsBySection[session.sectionId!][session.index];
  return question.correctIndex;
}
