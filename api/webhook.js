export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ok");

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const BASE_URL = "https://school-bot-one.vercel.app";

  const MINI_APP_URL = `${BASE_URL}/`;
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

      if (!r1.ok) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: caption,
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
