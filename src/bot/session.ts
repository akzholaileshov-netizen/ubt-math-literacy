import { findSection, questionsBySection, sections } from '../data/catalog';
import { secondsSpent } from '../services/points';
import type { Lang, Question } from '../types';
import { gradeTimedAnswer, MAX_ANSWER_POINTS } from './score';

export type RecordedAnswer = {
  questionId: string;
  selectedIndex: number | null;
  timedOut: boolean;
  secondsLeft: number;
  correct: boolean;
  points: number;
};

export type Phase = 'pick-language' | 'menu' | 'question' | 'summary';

/** Per-chat quiz. The question text and answer key stay in the catalog. */
export type Session = {
  lang: Lang | null;
  phase: Phase;
  sectionId: string | null;
  index: number;
  /** Epoch ms when the current question was shown. Null when no clock is running. */
  questionStartedAt: number | null;
  answers: RecordedAnswer[];
};

export type Step =
  | { ok: false }
  | {
      ok: true;
      session: Session;
      answer: RecordedAnswer;
      question: Question;
      finished: boolean;
    };

export type Summary = {
  answered: number;
  correct: number;
  percent: number;
  points: number;
  maxPoints: number;
  timeSpentSeconds: number;
  sectionSize: number;
};

export type SessionStore = {
  get(chatId: number): Session;
  set(chatId: number, session: Session): void;
};

export function blankSession(): Session {
  return {
    lang: null,
    phase: 'pick-language',
    sectionId: null,
    index: 0,
    questionStartedAt: null,
    answers: [],
  };
}

export function createSessionStore(): SessionStore {
  const map = new Map<number, Session>();
  return {
    get(chatId) {
      return map.get(chatId) ?? blankSession();
    },
    set(chatId, session) {
      map.set(chatId, session);
    },
  };
}

export function bankSize(): {
  sections: number;
  questionsPerSection: number;
  maxPerAnswer: number;
  maxPerSection: number;
} {
  const counts = sections.map((section) => questionsBySection[section.id]?.length ?? 0);
  const uniform = counts.length > 0 && counts.every((count) => count === counts[0] && count > 0);
  const questionsPerSection = uniform ? counts[0] : 0;
  return {
    sections: sections.length,
    questionsPerSection,
    maxPerAnswer: MAX_ANSWER_POINTS,
    maxPerSection: questionsPerSection * MAX_ANSWER_POINTS,
  };
}

export function chooseLanguage(session: Session, lang: Lang): Session {
  return {
    ...session,
    lang,
    phase: session.phase === 'pick-language' ? 'menu' : session.phase,
  };
}

/** Drop the current quiz and return to the section list, keeping the language. */
export function leaveQuiz(session: Session): Session {
  return {
    lang: session.lang,
    phase: session.lang ? 'menu' : 'pick-language',
    sectionId: null,
    index: 0,
    questionStartedAt: null,
    answers: [],
  };
}

/**
 * Open a section. The session stores the section id, index, and clock —
 * not a copy of the prompts or answer keys.
 */
export function beginSection(session: Session, sectionId: string, now: number): Session | null {
  if (session.lang !== 'kk' && session.lang !== 'ru') return null;
  if (!Number.isFinite(now)) return null;
  const section = findSection(sectionId);
  const questions = questionsBySection[sectionId];
  if (!section || !questions || questions.length === 0) return null;
  return {
    lang: session.lang,
    phase: 'question',
    sectionId,
    index: 0,
    questionStartedAt: now,
    answers: [],
  };
}

/** The catalog question for the active clock, or null when the student is not answering. */
export function activeQuestion(session: Session): Question | null {
  if (session.phase !== 'question' || !session.sectionId) return null;
  const questions = questionsBySection[session.sectionId];
  if (!questions) return null;
  return questions[session.index] ?? null;
}

export function submitAnswer(session: Session, index: number, choice: number, now: number): Step {
  if (session.phase !== 'question' || session.index !== index) return { ok: false };
  if (choice !== 0 && choice !== 1 && choice !== 2 && choice !== 3) return { ok: false };
  if (session.questionStartedAt == null) return { ok: false };
  return record(session, choice, now);
}

/** Score 0 and move on when the stored clock is already finished. */
export function expireQuestion(session: Session, index: number, startedAt: number, now: number): Step {
  if (session.phase !== 'question' || session.index !== index) return { ok: false };
  if (session.questionStartedAt !== startedAt) return { ok: false };
  if (!Number.isFinite(now)) return { ok: false };
  const step = record(session, null, now);
  if (!step.ok || !step.answer.timedOut) return { ok: false };
  return step;
}

export function summarize(session: Session): Summary {
  const answered = session.answers.length;
  const correct = session.answers.filter((answer) => answer.correct).length;
  const points = session.answers.reduce((sum, answer) => sum + answer.points, 0);
  const timeSpentSeconds = session.answers.reduce((sum, answer) => sum + secondsSpent(answer.secondsLeft), 0);
  const sectionSize = session.sectionId ? (questionsBySection[session.sectionId]?.length ?? answered) : answered;
  const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100);
  return {
    answered,
    correct,
    percent,
    points,
    maxPoints: sectionSize * MAX_ANSWER_POINTS,
    timeSpentSeconds,
    sectionSize,
  };
}

function record(session: Session, choice: 0 | 1 | 2 | 3 | null, now: number): Step {
  const questions = session.sectionId ? questionsBySection[session.sectionId] : undefined;
  const question = activeQuestion(session);
  if (!questions || !question || session.questionStartedAt == null) return { ok: false };
  if (session.index < 0 || session.index >= questions.length) return { ok: false };
  const graded = gradeTimedAnswer({
    choiceMatches: choice !== null && choice === question.correctIndex,
    startedAtMs: session.questionStartedAt,
    nowMs: now,
  });
  if (choice === null && !graded.timedOut) return { ok: false };
  const answer: RecordedAnswer = {
    questionId: question.id,
    selectedIndex: graded.timedOut ? null : choice,
    timedOut: graded.timedOut,
    secondsLeft: graded.secondsLeft,
    correct: graded.correct,
    points: graded.points,
  };
  const answers = [...session.answers, answer];
  const finished = session.index + 1 >= questions.length;
  const next: Session = finished
    ? {
        ...session,
        phase: 'summary',
        answers,
        questionStartedAt: null,
      }
    : {
        ...session,
        phase: 'question',
        index: session.index + 1,
        questionStartedAt: now,
        answers,
      };
  return { ok: true, session: next, answer, question, finished };
}
