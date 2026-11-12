import { describe, expect, it } from 'vitest';
import { questionsBySection, sections } from '../data/catalog';
import { isCorrect } from '../quiz/score';
import { pointsForAnswer } from '../services/points';
import {
  activeQuestion,
  bankSize,
  beginSection,
  blankSession,
  chooseLanguage,
  expireQuestion,
  leaveQuiz,
  submitAnswer,
  summarize,
  type RecordedAnswer,
  type Session,
} from './session';
import type { Question } from '../types';

function ready(lang: 'kk' | 'ru' = 'kk'): Session {
  return chooseLanguage(blankSession(), lang);
}

function expectMatchesApp(question: Question, answer: RecordedAnswer) {
  expect(
    isCorrect(question, {
      questionId: answer.questionId,
      selectedIndex: answer.selectedIndex,
      timedOut: answer.timedOut,
      secondsLeft: answer.secondsLeft,
    }),
  ).toBe(answer.correct);
  expect(pointsForAnswer(answer.correct, answer.secondsLeft)).toBe(answer.points);
}

describe('quiz session', () => {
  it('describes the shared bank as seven sections of 30 questions, max 600', () => {
    expect(bankSize()).toEqual({
      sections: 7,
      questionsPerSection: 30,
      maxPerAnswer: 20,
      maxPerSection: 600,
    });
  });

  it('requires a language and a real section before starting the clock', () => {
    expect(beginSection(blankSession(), 'numbers', 1_000)).toBeNull();
    expect(beginSection(ready(), 'algebra', 1_000)).toBeNull();
    expect(beginSection(ready(), 'numbers', Number.NaN)).toBeNull();
  });

  it('uses the catalog question object and its answer key', () => {
    for (const section of sections) {
      const session = beginSection(ready(), section.id, 50);
      expect(session?.sectionId).toBe(section.id);
      expect(activeQuestion(session!)).toBe(questionsBySection[section.id][0]);
    }
  });

  it('stores the start time and scores an immediate correct answer at 20', () => {
    const start = 8_000;
    const session = beginSection(ready(), 'numbers', start)!;
    const question = activeQuestion(session)!;
    expect(session.questionStartedAt).toBe(start);
    const step = submitAnswer(session, 0, question.correctIndex, start);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.question).toBe(question);
    expect(step.answer).toMatchObject({
      questionId: question.id,
      selectedIndex: question.correctIndex,
      timedOut: false,
      secondsLeft: 300,
      correct: true,
      points: 20,
    });
    expectMatchesApp(question, step.answer);
    expect(step.session.index).toBe(1);
    expect(step.session.questionStartedAt).toBe(start);
    expect(activeQuestion(step.session)).toBe(questionsBySection.numbers[1]);
  });

  it('scores from the stored start, not from a fresh 300 second grant', () => {
    const start = 20_000;
    const session = beginSection(ready('ru'), 'percents', start)!;
    const question = activeQuestion(session)!;
    const step = submitAnswer(session, 0, question.correctIndex, start + 60_000);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.answer.secondsLeft).toBe(240);
    expect(step.answer.points).toBe(18);
    expect(summarize(step.session).timeSpentSeconds).toBe(60);
    expectMatchesApp(question, step.answer);
  });

  it('gives a wrong answer zero points and still advances', () => {
    const start = 3_000;
    const session = beginSection(ready(), 'word', start)!;
    const question = activeQuestion(session)!;
    const wrong = ((question.correctIndex + 1) % 4) as 0 | 1 | 2 | 3;
    const step = submitAnswer(session, 0, wrong, start + 60_000);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.answer).toMatchObject({
      selectedIndex: wrong,
      timedOut: false,
      secondsLeft: 240,
      correct: false,
      points: 0,
    });
    expect(step.session.index).toBe(1);
    expectMatchesApp(question, step.answer);
  });

  it('scores a late correct tap as a timeout worth zero', () => {
    const start = 4_000;
    const session = beginSection(ready(), 'logic', start)!;
    const question = activeQuestion(session)!;
    const step = submitAnswer(session, 0, question.correctIndex, start + 300_000);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.answer).toMatchObject({
      selectedIndex: null,
      timedOut: true,
      secondsLeft: 0,
      correct: false,
      points: 0,
    });
    expect(step.session.questionStartedAt).toBe(start + 300_000);
    expect(summarize(step.session).timeSpentSeconds).toBe(300);
    expectMatchesApp(question, step.answer);
  });

  it('ignores a stale choice and an early timeout', () => {
    const start = 9_000;
    const session = beginSection(ready(), 'geometry', start)!;
    expect(submitAnswer(session, 4, 0, start).ok).toBe(false);
    expect(expireQuestion(session, 0, start, start + 299_999).ok).toBe(false);
    expect(session.answers).toEqual([]);
    const expired = expireQuestion(session, 0, start, start + 300_000);
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    expect(expired.answer.timedOut).toBe(true);
    expect(submitAnswer(expired.session, 0, 0, start + 301_000).ok).toBe(false);
    expect(expireQuestion(expired.session, 0, start, start + 300_000).ok).toBe(false);
  });

  it('keeps the stored clock when the language changes and clears it when leaving', () => {
    const start = 11_000;
    const session = beginSection(ready(), 'charts', start)!;
    const switched = chooseLanguage(session, 'ru');
    expect(switched.lang).toBe('ru');
    expect(switched.phase).toBe('question');
    expect(switched.questionStartedAt).toBe(start);
    const left = leaveQuiz(switched);
    expect(left.lang).toBe('ru');
    expect(left.phase).toBe('menu');
    expect(left.questionStartedAt).toBeNull();
    expect(left.answers).toEqual([]);
  });

  it('restarts a finished section from question 1', () => {
    let session = beginSection(ready(), 'combinatorics', 1)!;
    const again = beginSection(session, 'combinatorics', 99);
    expect(again?.index).toBe(0);
    expect(again?.answers).toEqual([]);
    expect(again?.questionStartedAt).toBe(99);
    session = again!;
    expect(activeQuestion(session)).toBe(questionsBySection.combinatorics[0]);
  });

  it('totals a perfect section at 600 points', () => {
    let session = beginSection(ready(), 'numbers', 100)!;
    for (let index = 0; index < 30; index += 1) {
      const question = activeQuestion(session);
      expect(question).toBe(questionsBySection.numbers[index]);
      const step = submitAnswer(session, index, question!.correctIndex, session.questionStartedAt!);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      expect(step.answer.points).toBe(20);
      session = step.session;
    }
    expect(session.phase).toBe('summary');
    expect(session.sectionId).toBe('numbers');
    expect(summarize(session)).toEqual({
      answered: 30,
      correct: 30,
      percent: 100,
      points: 600,
      maxPoints: 600,
      timeSpentSeconds: 0,
      sectionSize: 30,
    });
    const retry = beginSection(session, session.sectionId!, 500);
    expect(retry?.phase).toBe('question');
    expect(retry?.index).toBe(0);
    expect(retry?.answers).toEqual([]);
  });
});
