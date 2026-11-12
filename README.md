# Математикалық сауаттылық · ҰБТ / ЕНТ

Bilingual (Kazakh and Russian) study app for the math-literacy part of ҰБТ / ЕНТ. Seven sections, 30 questions each, a 300-second timer on every question, favorites, a personal dashboard, and a leaderboard.

Everything stays in this browser. Profiles, attempts, progress, and favorites are stored in `localStorage`. There is no account server. A real multi-user leaderboard would need a backend later; today the board is this device's saved students plus 30 demo profiles.

## Қазақша

Жеті тақырыптың әрқайсысында теория және 30 есеп бар. Әр есепке 5 минут (300 секунд). Тіл («Қаз» / «Рус») мен қараңғы/жарық режим жоғарғы оң жақта. Лақап атпен тіркелсеңіз, нәтиже, прогресс және қиын есептер осы браузердің `localStorage` жадында сақталады. Интернетсіз де осы құрылғыда жұмыс істейді. Көшбасшылар тізімінде 30 дайын оқушы бар. Бірнеше адамға ортақ тізім үшін кейін бөлек сервер керек.

Іске қосу:

```bash
npm install
npm run dev
```

Тексеру: `npm test`, `npm run validate`, `npm run build`.

Vercel: Framework **Vite**, build `npm run build`, output `dist`, Node.js **22.x**. Node 20 жаңа деплойда қабылданбайды.

### Ұпай

Дұрыс жауап: **10 + floor(қалған секунд / 30)**, ең көбі 20. Қате және уақыт бітуі: 0. Бір тест ең көбі 600 ұпай. Жұмсалған уақыт: `300 − қалған секунд`.

Көшбасшылар әдепкіде ұпай бойынша (көбі жоғары; тең болса шешілген есеп, содан аз уақыт). Уақыт сұрыптауы жұмсалған секундты көрсетеді (көбі жоғары). Шешілген — дұрыс жауап саны.

### Telegram-бот

Бот сайттағы сол жеті бөлімді, 210 есепті және жауап кілттерін қолданады. Ұпай да сол: дұрыс жауап **10 + floor(қалған секунд / 30)**, ең көбі 20. 300 секундтық сағат есеп хабарламасы жіберілген сәтте сақталады. Қате және уақыт бітуі — 0.

Ботта ортақ көшбасшылар тізімі, сақталған есептер және жеке кабинет жоқ. Олар браузердегі қолданбада қалады. Сессия бот процесінің жадында ғана: процесс тоқтаса, аяқталмаған тест жоғалады.

1. Telegram-да [@BotFather](https://t.me/BotFather) ашыңыз.
2. `/newbot` жіберіңіз, ат пен `bot` деп аяқталатын username беріңіз.
3. BotFather көрсеткен токенді көшіріңіз.
4. Токенді тек `TELEGRAM_BOT_TOKEN` орта айнымалысына қойыңыз. Токенді және `.env` файлын коммит етпеңіз. Бот файлдан токен оқымайды.

```bash
npm install
export TELEGRAM_BOT_TOKEN="your-token-from-BotFather"
npm run bot
```

Содан кейін ботпен жеке чатта `/start` жіберіңіз. Тілді таңдап, бөлімді ашыңыз. Жауап A–D батырмасымен немесе сол әріппен беріледі. Бот long polling қолданады және іске қосылғанда webhook-ты өшіреді. Бір токенмен екінші дананы қатар қоспаңыз.

Командалар: `/start`, `/sections`, `/language`, `/stop`, `/help`.

## Русский

В каждой из семи тем есть теория и 30 задач. На задачу даётся 5 минут (300 секунд). Язык и тема переключаются справа сверху. После входа по имени результат, прогресс и трудные задачи хранятся в `localStorage` этого браузера и доступны без сети. В таблице лидеров уже есть 30 учебных профилей. Общая таблица для разных людей потребует отдельный сервер позже.

```bash
npm install
npm run dev
```

Проверка: `npm test`, `npm run validate`, `npm run build`.

Vercel: пресет **Vite**, команда `npm run build`, каталог `dist`, Node.js **22.x**. Node 20 для новых деплоев отключён.

### Очки

Верный ответ: **10 + floor(оставшиеся секунды / 30)**, максимум 20. Ошибка и тайм-аут: 0. Максимум за тест — 600. Затраченное время: `300 − оставшиеся секунды`.

Таблица по умолчанию сортируется по очкам (больше выше; при равенстве — больше решённых, затем меньше времени). Сортировка по времени — потраченные секунды (больше выше). По решённым — число верных ответов.

### Telegram-бот

Бот берёт те же семь разделов, 210 задач и ключи ответов, что и сайт. Верный ответ: **10 + floor(оставшиеся секунды / 30)**, максимум 20. Часы на 300 секунд запоминаются в момент отправки задачи. Ошибка и тайм-аут — 0.

В боте нет общей таблицы лидеров, избранного и личного кабинета: это остаётся в браузерном приложении. Сессия живёт только в памяти процесса. Если процесс остановить, незаконченный тест пропадёт.

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. Отправьте `/newbot`, задайте имя и username, который заканчивается на `bot`.
3. Скопируйте токен, который пришлёт BotFather.
4. Положите его только в переменную `TELEGRAM_BOT_TOKEN`. Не коммитьте токен и не коммитьте `.env`. Бот не читает токен из файла.

```bash
npm install
export TELEGRAM_BOT_TOKEN="your-token-from-BotFather"
npm run bot
```

Дальше откройте личный чат с ботом и отправьте `/start`. Выберите язык и раздел. Ответ — кнопки A–D или та же буква. Бот работает через long polling и при запуске снимает webhook. Не запускайте второй процесс с тем же токеном.

Команды: `/start`, `/sections`, `/language`, `/stop`, `/help`.

## English

```bash
npm install
npm run dev
```

`npm test` covers scoring, the local store, and the Telegram bot's clock and session logic. `npm run validate` checks the 210 answer keys. `npm run build` typechecks and builds. `vercel.json` sets the Vite preset, `npm run build`, and output directory `dist`. The SPA rewrite runs only after static files, so `/assets` is served from `dist`. `engines.node` is `22.x`: Vite 7 needs Node 22.12 or newer, and Vercel rejects Node 20 on new deployments (the current default for a new project is 24.x, which also works).

The app is fully local. Profiles, attempts, per-section progress, and favorites live in `localStorage`, and the leaderboard seeds 30 demo students. Anonymous quizzes create a guest profile that can be claimed with a nickname. Existing `ubt-favorites` entries move into that profile. Sharing one leaderboard across people would need a backend later.

### Points

A correct answer scores `10 + floor(secondsLeft / 30)`, capped by the 300-second clock, so the maximum is 20. A wrong answer or a timeout scores 0. A full quiz is worth at most 600 points. Time spent on a question is `300 - secondsLeft`.

Leaderboard sort:

- **Points** (default): higher points, then more solved, then less time.
- **Time**: more seconds spent, then more points.
- **Solved**: more correct answers, then more points, then less time.

### Telegram bot

`npm run bot` starts a long-polling bot (`tsx src/bot/main.ts`). It imports sections, questions, and answer keys from `src/data/catalog.ts` and scores with `pointsForAnswer` in `src/services/points.ts`. The 300-second clock is the question's stored start time. Remaining seconds are the ceiling of the time left until that start plus 300 seconds, the same clock as the site. A tap at or after that deadline is a timeout and scores 0, including a tap on the right option.

The token is read only from `TELEGRAM_BOT_TOKEN`. The process does not load a dotenv file. `.gitignore` already ignores `.env` and `.env*`. Do not commit a token.

BotFather:

1. Open [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and choose a display name and a username ending in `bot`.
3. Copy the token BotFather returns.
4. Export it in the shell as `TELEGRAM_BOT_TOKEN`. Do not put it in the repo.

```bash
npm install
export TELEGRAM_BOT_TOKEN="your-token-from-BotFather"
npm run bot
```

Then open a private chat with the bot and send `/start`. Pick Kazakh or Russian, then a section. Answers are the A–D buttons, or the same letter typed on its own. On startup the bot calls `deleteWebhook` so long polling can run. Do not run a second poller with the same token.

Commands: `/start`, `/sections`, `/language`, `/stop`, `/help`.

Sessions live in the bot process. Restarting it drops an unfinished quiz. `/stop` shows the points so far and clears the clock. This bot does not include a shared leaderboard, favorites, or the personal dashboard — those stay in the browser app.
