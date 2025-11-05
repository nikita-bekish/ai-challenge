import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.prod" });
} else {
  dotenv.config({ path: ".env.dev" });
}

console.log("🚀 Запуск бота в режиме:", process.env.MODE || "development");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const memory = new Map(); // хранит временную историю сообщений в рамках одного диалога
const userFormats = new Map(); // chatId → "json" | "markdown"

bot.onText(/\/start/i, (msg) => {
  const chatId = msg.chat.id;

  const welcomeMessage = `
👋 Привет! Я бот, который помогает формировать ответы в нужном тебе формате.

Ты можешь выбрать формат вывода:
- \`/format json\` — получать ответы в виде JSON  
- \`/format markdown\` — получать ответы в виде Markdown

Просто напиши свой вопрос, и я отвечу в выбранном формате.
`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
});

bot.onText(/\/format (json|markdown)/i, (msg, match) => {
  const chatId = msg.chat.id;
  const format = match[1].toLowerCase();
  userFormats.set(chatId, format);
  bot.sendMessage(
    chatId,
    `✅ Формат ответа установлен: ${format.toUpperCase()}`
  );
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text?.trim();

  if (
    !userText ||
    userText.startsWith("/format") ||
    userText.startsWith("/start")
  )
    return;

  if (!memory.has(chatId)) memory.set(chatId, []);
  const context = memory.get(chatId);
  context.push({ role: "user", content: userText });

  bot.sendChatAction(chatId, "typing");

  const format = userFormats.get(chatId) || "json";

  try {
    const response = await fetch(`${process.env.API_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: context, format }),
    });

    const data = await response.json();
    const answer = data.answer || "⚠️ Нет ответа от модели";

    bot.sendMessage(chatId, answer, {
      parse_mode: format === "markdown" ? "Markdown" : undefined,
    });

    // добавляем ответ в контекст
    context.push({ role: "assistant", content: answer });

    // при необходимости ограничиваем длину истории
    if (context.length > 10) {
      context.splice(0, context.length - 10); // храним только последние 10 сообщений
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "🚨 Ошибка при обращении к серверу.");
  }
});

console.log("🤖 Бот без summary-памяти запущен!");
