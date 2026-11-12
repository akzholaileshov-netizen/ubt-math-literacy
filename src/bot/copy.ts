import { QUESTION_SECONDS } from '../quiz/time';
import { POINT_BASE, POINT_SPEED_CHUNK } from '../services/points';
import type { Lang } from '../types';

export type BankFigures = {
  sections: number;
  questionsPerSection: number;
  maxPerAnswer: number;
  maxPerSection: number;
};

export type SummaryFigures = {
  title: string;
  done: boolean;
  answered: number;
  correct: number;
  percent: number;
  points: number;
  maxPoints: number;
  sectionSize: number;
  duration: string;
};

const minutes = QUESTION_SECONDS / 60;

function ruPoints(points: number): string {
  const n = Math.abs(points);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${points} очко`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${points} очка`;
  return `${points} очков`;
}

export const botCommands: Record<Lang, { command: string; description: string }[]> = {
  kk: [
    { command: 'start', description: 'Бастау' },
    { command: 'sections', description: 'Бөлімдер' },
    { command: 'language', description: 'Тіл' },
    { command: 'stop', description: 'Тестті тоқтату' },
    { command: 'help', description: 'Көмек' },
  ],
  ru: [
    { command: 'start', description: 'Начать' },
    { command: 'sections', description: 'Разделы' },
    { command: 'language', description: 'Язык' },
    { command: 'stop', description: 'Остановить тест' },
    { command: 'help', description: 'Помощь' },
  ],
};

export const copy = {
  kk: {
    pickLanguage: 'Тілді таңдаңыз.',
    language: 'Тіл',
    sections: 'Бөлімдер',
    retry: 'Қайта шығару',
    hint: 'Кеңес',
    solution: 'Шешуі',
    correctAnswer: 'Дұрыс жауап',
    correctToast: 'Дұрыс',
    wrongToast: 'Қате',
    timeoutToast: 'Уақыт бітті',
    stale: 'Бұл есеп жабық.',
    stopped: 'Ағымдағы тест тоқтатылды.',
    useButtons: 'Жауапты A, B, C, D батырмасымен немесе сол әріппен жіберіңіз.',
    pickOption: 'Жауап: A, B, C немесе D.',
    unknownSection: 'Мұндай бөлім жоқ. Тізімнен таңдаңыз.',
    helpClock:
      'Әр есепке берілген 300 секунд сол есеп жіберілген сәттен бастап саналады. Уақыт бітсе, жауап 0 ұпай — дұрыс нұсқаны кеш бассаңыз да.',
    menu: (size: BankFigures) =>
      `${size.sections} бөлім, әрқайсысында ${size.questionsPerSection} есеп. Әр есепке ${minutes} минут (${QUESTION_SECONDS} секунд).\n\nДұрыс жауап: ${POINT_BASE} ұпай және қалған әр ${POINT_SPEED_CHUNK} секунд үшін +1, ең көбі ${size.maxPerAnswer}. Қате жауап пен уақыттың бітуі — 0. Бір бөлім ең көбі ${size.maxPerSection} ұпай.\n\nБөлімді таңдаңыз.`,
    questionProgress: (index: number, total: number) => `Сұрақ ${index}/${total}`,
    timeAllowance: (clock: string) => `Берілген уақыт: ${clock}`,
    correct: (points: number, left: string) => `Дұрыс. +${points} ұпай.\nҚалған уақыт: ${left}.`,
    wrong: 'Қате. 0 ұпай.',
    timeout: 'Уақыт бітті. 0 ұпай.',
    summary: (input: SummaryFigures) => {
      const head = input.done ? 'Нәтиже' : 'Аралық нәтиже';
      const scoreLine = input.done
        ? `Дұрыс: ${input.correct}/${input.sectionSize} (${input.percent}%)\nҰпай: ${input.points} / ${input.maxPoints}`
        : `Жауап берілді: ${input.answered}/${input.sectionSize}\nДұрыс: ${input.correct}/${input.answered}\nҰпай: ${input.points}`;
      const tail = input.done ? '\n\nТөменде бөлімдерге оралуға немесе осы бөлімді қайта шығаруға болады.' : '';
      return `${head}\n${input.title}\n${scoreLine}\nЖұмсалған уақыт: ${input.duration}${tail}`;
    },
  },
  ru: {
    pickLanguage: 'Выберите язык.',
    language: 'Язык',
    sections: 'Разделы',
    retry: 'Пройти снова',
    hint: 'Подсказка',
    solution: 'Решение',
    correctAnswer: 'Правильный ответ',
    correctToast: 'Верно',
    wrongToast: 'Неверно',
    timeoutToast: 'Время вышло',
    stale: 'Эта задача уже закрыта.',
    stopped: 'Текущий тест остановлен.',
    useButtons: 'Отправьте ответ кнопкой A, B, C или D либо той же буквой.',
    pickOption: 'Ответ: A, B, C или D.',
    unknownSection: 'Такого раздела нет. Выберите из списка.',
    helpClock:
      '300 секунд на задачу считаются с момента отправки её сообщения. Если время вышло, ответ даёт 0 очков, даже когда выбран верный вариант.',
    menu: (size: BankFigures) =>
      `${size.sections} разделов, по ${size.questionsPerSection} задач в каждом. На задачу ${minutes} минут (${QUESTION_SECONDS} секунд).\n\nВерный ответ: ${POINT_BASE} очков и ещё 1 за каждые ${POINT_SPEED_CHUNK} оставшихся секунд, максимум ${size.maxPerAnswer}. Ошибка и тайм-аут — 0. За раздел максимум ${size.maxPerSection} очков.\n\nВыберите раздел.`,
    questionProgress: (index: number, total: number) => `Вопрос ${index}/${total}`,
    timeAllowance: (clock: string) => `Отведённое время: ${clock}`,
    correct: (points: number, left: string) => `Верно. +${ruPoints(points)}.\nОставшееся время: ${left}.`,
    wrong: 'Неверно. 0 очков.',
    timeout: 'Время вышло. 0 очков.',
    summary: (input: SummaryFigures) => {
      const head = input.done ? 'Результат' : 'Промежуточный результат';
      const scoreLine = input.done
        ? `Верно: ${input.correct}/${input.sectionSize} (${input.percent}%)\nОчки: ${input.points} / ${input.maxPoints}`
        : `Ответов: ${input.answered}/${input.sectionSize}\nВерно: ${input.correct}/${input.answered}\nОчки: ${input.points}`;
      const tail = input.done ? '\n\nНиже можно вернуться к разделам или пройти этот раздел снова.' : '';
      return `${head}\n${input.title}\n${scoreLine}\nЗатраченное время: ${input.duration}${tail}`;
    },
  },
} as const;
