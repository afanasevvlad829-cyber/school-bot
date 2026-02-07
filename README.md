# school-bot — Telegram Mini App «Какой ты родитель в школьном чате?»

Telegram Mini App (WebApp) с вирусным тестом (3 режима: **Мемно / Токсично / Злобно**), результатом, шарингом, CTA и экраном общей статистики.  
Статистика прохождений пишется **в Google Sheets** через **Google Apps Script Web App** (в одну строку на сессию по `session_id`).

## Демо
- Web (Vercel): https://school-bot-one.vercel.app/
- Telegram bot: `@schoolchat1_bot`

---

## Структура проекта (для Vercel)

Vercel раздаёт статику из папки `public/`.

school-bot/
public/
index.html
css/
styles.css
js/
config.js
questions.js
types.js
app.js
assets/
logo.png
README.md
vercel.json (опционально)


> Важно: если ты добавил `public/`, файлы **нужно хранить внутри неё**, иначе ссылки на `/js/*`, `/css/*`, `/assets/*` могут не работать.

---

## Где что менять

### 1) Настройки (конфиги/ссылки/бот/статистика)
**`public/js/config.js`** — тут живут:
- `BOT_USERNAME` = `schoolchat1_bot`
- `AIDACAMP_URL` = https://aidacamp.ru/
- `CODIMS_URL` = https://codims.ru/
- `STATS_URL` = URL Apps Script Web App
- `UTM` — UTM метки для кнопок

Пример:
```js
window.APP_CONFIG = {
  BOT_USERNAME: "schoolchat1_bot",
  startapp: "schoolchat",
  AIDACAMP_URL: "https://aidacamp.ru/",
  CODIMS_URL: "https://codims.ru/",
  STATS_URL: "https://script.google.com/macros/s/AKfycbyKYHYE-05LcVAG-_bQFRwQgh6CkCA51IlfbTut5rH8BzluATdhtxd7-7pzAgislzqQ/exec",
  UTM: {
    utm_source: "telegram",
    utm_medium: "miniapp",
    utm_campaign: "schoolchat_test"
  }
};
2) Вопросы
public/js/questions.js
Содержит массивы вопросов:

base (5 вопросов)

accuracy (+2 вопроса)
и отдельно по режимам.

3) Типы/описания/мемы
public/js/types.js
Тут вся “психиатрия школьного чата”:

названия типов

soft/toxic/evil тексты

мем-теги

референсы из кино/мультов

(если есть) SVG аватарки / связи

4) Логика приложения
public/js/app.js
Тут:

переключатель режимов

подсчёт баллов

экран результата

кнопки шаринга/CTA

модалка общей статистики

отправка статистики в Google Sheet

Google Sheets статистика (Apps Script)
1) В какую вкладку пишет?
Запись идёт в:

Spreadsheet ID: задан в Apps Script как SHEET_ID

Вкладка (лист): SHEET_NAME = "sessions"

Если вкладки sessions нет — скрипт создаст её сам.

2) Публикация Apps Script как Web App
В Apps Script:

Deploy → New deployment

Type: Web app

Execute as: Me

Who has access: Anyone (или Anyone with link)

Deploy → получаешь URL вида:
https://script.google.com/macros/s/<ID>/exec

Этот URL должен стоять в public/js/config.js как STATS_URL.

3) Формат POST из клиента (важно!)
Клиент (app.js) отправляет статистику как:

{ "payload": { ... } }
и с заголовком:

Content-Type: text/plain;charset=utf-8
Это сделано, чтобы Apps Script стабильно читал e.postData.contents.

4) Как пишется “в одну строку”
Apps Script делает upsert:

если session_id новый → appendRow

если session_id уже есть → перезаписывает строку этой сессии

Какие события пишутся
Запись обновляется на ключевых шагах:

finish — показ результата

share — кнопка “Переслать”

meme_copy — “Скопировать короткий мем”

cta_codims / cta_aidacamp — клики по CTA

restart — перезапуск

pagehide — уход со страницы во время прохождения (abandoned)

Деплой на Vercel через GitHub
1) GitHub
Коммитишь весь проект

Проверяешь, что public/index.html на месте

2) Vercel
Vercel → Add New Project

Import GitHub repo school-bot

Framework: Other

Build Command: пусто / none

Output Directory: public

Deploy

Получишь URL вида: https://<project>.vercel.app/

Подключение Mini App в Telegram (BotFather)
1) Установка Menu Button (WebApp URL)
BotFather:

/mybots → выбрать бота → Bot Settings → Menu Button

Указать URL Vercel, например:
https://school-bot-one.vercel.app/

Если не видно Menu Button:

обнови BotFather

зайди в настройки бота ещё раз (иногда “подгружается” не сразу)

2) Проверка
Открой @schoolchat1_bot → кнопка меню → открывается Mini App.

Частые проблемы и решения
“В таблице заполняется только ts_iso, остальные поля пустые”
Почти всегда причина:

клиент отправляет не { payload: {...} }, или

Apps Script деплой не обновлён, или

нет Content-Type, и e.postData.contents пустой.

Решение:

в app.js отправлять: JSON.stringify({ payload })

заголовок: Content-Type: text/plain;charset=utf-8

Apps Script: Deploy → Manage deployments → Edit → Deploy

проверить, что STATS_URL в config.js = актуальный /exec

“В какую вкладку пишет?”
Вкладка задана как sessions (SHEET_NAME = "sessions").

