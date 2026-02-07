export default async function handler(req, res) {
  // Telegram шлёт только POST
  if (req.method !== "POST") return res.status(200).send("ok");

  const BOT_TOKEN = process.env.BOT_TOKEN;

  // Твой домен проекта
  const BASE_URL = "https://school-bot-one.vercel.app";

  // Mini App в корне (index.html)
  const MINI_APP_URL = `${BASE_URL}/`;

  // Картинка в корне проекта: /assets/start.jpg
  const START_IMAGE_URL = `${BASE_URL}/assets/start.jpg`;

  try {
    const update = req.body;

    const msg = update.message || update.edited_message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();

    if (text === "/start" || text.startsWith("/start")) {
      const caption =
`😈 Тест на 35 секунд: «Какой ты родитель в школьном чате?»
Узнаешь себя — и сразу пересылаешь в чат.

Режимы: Мемно / Токсично / Злобно`;

      const reply_markup = {
        inline_keyboard: [
          [{ text: "🚀 Начать тест", web_app: { url: MINI_APP_URL } }],
          [{ text: "↗️ Открыть в браузере", url: MINI_APP_URL }]
        ]
      };

      // 1) Пытаемся отправить фото
      const r1 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: START_IMAGE_URL,
          caption,
          reply_markup
        })
      });

      // 2) Если фото не прошло — fallback на текст
      if (!r1.ok) {
        const errText = await r1.text().catch(() => "");
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: caption + (errText ? `\n\n(Фото не отправилось)` : ""),
            reply_markup
          })
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: true, err: String(e?.message || e) });
  }
}
