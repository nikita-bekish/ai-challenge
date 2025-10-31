import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const prompt = msg.text?.trim();

  if (!prompt) {
    bot.sendMessage(chatId, "✍️ Отправь мне текст, и я отвечу с помощью ИИ.");
    return;
  }

  bot.sendMessage(chatId, "🤖 Думаю...");

  try {
    const response = await fetch(`${process.env.API_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    const answer = data.answer || "⚠️ Нет ответа от модели";

    bot.sendMessage(chatId, answer);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "🚨 Ошибка при обращении к серверу.");
  }
});
