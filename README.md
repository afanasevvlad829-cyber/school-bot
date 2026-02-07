# school-bot — Telegram Mini App “Какой ты родитель в школьном чате?”

Мем-тест на 35 секунд с результатом, “режим токсик”, опцией “точность (+2 вопроса)” и кнопками CTA.

## Файлы
- `index.html` — разметка экранов
- `css/styles.css` — стили (вопросы светлые, кнопки результата зелёные)
- `js/config.js` — конфиг (бот, ссылки, UTM, endpoint статистики)
- `js/questions.js` — массив вопросов/ответов
- `js/types.js` — 12 типов + тексты + SVG “монетки”
- `js/app.js` — логика теста и статистика
- `assets/logo.png` — логотип

## Статистика (1 строка на прохождение)
Отправляется в Google Sheets через Google Apps Script.
Логика: создаётся `session_id`, данные копятся локально и отправляются:
- при `finish`
- при кликах share/cta (upsert)
- при `pagehide` (если пользователь закрыл раньше)

В таблицу пишется лист `sessions`.

## Настройка
1) Хостинг: положи папку на Vercel/Netlify/GitHub Pages (или любой статический хостинг)
2) В `js/config.js`:
   - `BOT_USERNAME`
   - `AIDACAMP_URL`, `CODIMS_URL`
   - `STATS_URL` (Apps Script Web App URL)
   - `UTM` параметры
3) В BotFather укажи URL Mini App на `index.html`

## UTM
Кнопки “АйДаКемп” и “АйДаКодить” автоматически добавляют UTM + bot + type + sid.

## Обновления контента
- меняешь вопросы → `js/questions.js`
- меняешь тексты типов → `js/types.js`
- меняешь ссылки/бота/UTM → `js/config.js`
