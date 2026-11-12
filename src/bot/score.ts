import { QUESTION_SECONDS } from '../quiz/time';
import { pointsForAnswer } from '../services/points';

/** Highest score for one correct answer on a full 300-second clock. */
export const MAX_ANSWER_POINTS = pointsForAnswer(true, QUESTION_SECONDS);

/** Epoch ms when the stored question clock runs out. */
export function questionDeadline(startedAtMs: number): number {
  return startedAtMs + QUESTION_SECONDS * 1000;
}

export type TimedGrade = {
  timedOut: boolean;
  secondsLeft: number;
  correct: boolean;
  points: number;
};

/**
 * Grade one tap against a stored question start.
 * Remaining time matches the site: ceil of ms left until start + 300s.
 * A tap at or after that deadline is a timeout and scores 0, even if the option is right.
 * Points themselves come from pointsForAnswer.
 */
export function gradeTimedAnswer(input: {
  choiceMatches: boolean;
  startedAtMs: number;
  nowMs: number;
}): TimedGrade {
  if (!Number.isFinite(input.startedAtMs) || !Number.isFinite(input.nowMs)) {
    return { timedOut: true, secondsLeft: 0, correct: false, points: pointsForAnswer(false, 0) };
  }
  const deadline = questionDeadline(input.startedAtMs);
  if (input.nowMs >= deadline) {
    return { timedOut: true, secondsLeft: 0, correct: false, points: pointsForAnswer(false, 0) };
  }
  const secondsLeft = Math.min(
    QUESTION_SECONDS,
    Math.max(0, Math.ceil((deadline - input.nowMs) / 1000)),
  );
  const correct = input.choiceMatches;
  return {
    timedOut: false,
    secondsLeft,
    correct,
    points: pointsForAnswer(correct, secondsLeft),
  };
}
