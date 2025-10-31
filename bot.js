import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const storePath = "./memoryStore.json";

function loadStore() {
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, "{}");
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function saveStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const memory = new Map();
let longTermMemory = loadStore();

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text?.trim();

  if (!userText) return;

  if (!memory.has(chatId)) memory.set(chatId, []);

  if (userText.toLowerCase().startsWith("меня зовут")) {
    const name = userText.replace(/меня зовут/i, "").trim();
    longTermMemory[chatId] = { name };
    saveStore(longTermMemory);
    return bot.sendMessage(chatId, `Приятно познакомиться, ${name}!`);
  }

  const userInfo = longTermMemory[chatId];
  const context = memory.get(chatId);

  const fullPrompt = userInfo
    ? `Пользователя зовут ${userInfo.name}. ${userText}`
    : userText;

  context.push({ role: "user", content: fullPrompt });

  if (context.length > 6) context.shift();

  bot.sendChatAction(chatId, "typing");

  try {
    const response = await fetch(`${process.env.API_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: context }),
    });

    const data = await response.json();
    const answer = data.answer || "⚠️ Нет ответа от модели";

    bot.sendMessage(chatId, answer);

    context.push({ role: "assistant", content: answer });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "🚨 Ошибка при обращении к серверу.");
  }
});

console.log("✅ Бот с памятью запущен!");
