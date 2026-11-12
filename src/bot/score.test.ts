import { describe, expect, it } from 'vitest';
import { QUESTION_SECONDS } from '../quiz/time';
import { pointsForAnswer } from '../services/points';
import { gradeTimedAnswer, MAX_ANSWER_POINTS, questionDeadline } from './score';

describe('telegram clock', () => {
  const start = 5_000_000;

  it('caps a correct answer at the same 20 points as the site', () => {
    expect(QUESTION_SECONDS).toBe(300);
    expect(MAX_ANSWER_POINTS).toBe(20);
    expect(pointsForAnswer(true, QUESTION_SECONDS)).toBe(20);
  });

  it('scores every in-time second with pointsForAnswer', () => {
    for (let left = 1; left <= QUESTION_SECONDS; left += 1) {
      const graded = gradeTimedAnswer({
        choiceMatches: true,
        startedAtMs: start,
        nowMs: start + (QUESTION_SECONDS - left) * 1000,
      });
      expect(graded.timedOut).toBe(false);
      expect(graded.correct).toBe(true);
      expect(graded.secondsLeft).toBe(left);
      expect(graded.points).toBe(pointsForAnswer(true, left));
    }
  });

  it('gives a wrong in-time answer zero points and keeps the remaining seconds', () => {
    const graded = gradeTimedAnswer({
      choiceMatches: false,
      startedAtMs: start,
      nowMs: start + 45_200,
    });
    expect(graded).toEqual({
      timedOut: false,
      secondsLeft: 255,
      correct: false,
      points: 0,
    });
    expect(pointsForAnswer(false, 255)).toBe(0);
  });

  it('scores a tap at the stored deadline as a timeout, not as a 0-second correct answer', () => {
    expect(pointsForAnswer(true, 0)).toBe(10);
    expect(questionDeadline(start)).toBe(start + 300_000);
    expect(
      gradeTimedAnswer({
        choiceMatches: true,
        startedAtMs: start,
        nowMs: start + 300_000 - 1,
      }),
    ).toEqual({
      timedOut: false,
      secondsLeft: 1,
      correct: true,
      points: 10,
    });
    expect(
      gradeTimedAnswer({
        choiceMatches: true,
        startedAtMs: start,
        nowMs: start + 300_000,
      }),
    ).toEqual({
      timedOut: true,
      secondsLeft: 0,
      correct: false,
      points: 0,
    });
  });

  it('treats a broken clock as a timeout', () => {
    expect(
      gradeTimedAnswer({ choiceMatches: true, startedAtMs: Number.NaN, nowMs: start }),
    ).toEqual({
      timedOut: true,
      secondsLeft: 0,
      correct: false,
      points: 0,
    });
  });

  it('does not let a clock that moved backwards score more than 20', () => {
    expect(
      gradeTimedAnswer({ choiceMatches: true, startedAtMs: 10_000, nowMs: 9_000 }),
    ).toMatchObject({ timedOut: false, secondsLeft: 300, points: 20 });
  });
});
