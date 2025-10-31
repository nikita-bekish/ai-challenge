import dotenv from "dotenv";
import fs from "fs";
// import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const memory = new Map();
const storePath = "./summaryMemory.json";

function loadSummary() {
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, "{}");
    return {};
  }
  const data = fs.readFileSync(storePath, "utf-8").trim();

  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn("⚠️ Ошибка чтения summaryMemory.json, файл будет сброшен.");
    fs.writeFileSync(storePath, "{}");
    return {};
  }
}

function saveSummary(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

let summaryMemory = loadSummary();

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text?.trim();

  if (!userText) return;

  if (!memory.has(chatId)) memory.set(chatId, []);

  // if (userText.toLowerCase().startsWith("меня зовут")) {
  //   const name = userText.replace(/меня зовут/i, "").trim();
  //   // longTermMemory[chatId] = { name };
  //   // saveStore(longTermMemory);
  //   return bot.sendMessage(chatId, `Приятно познакомиться, ${name}!`);
  // }

  // const userInfo = longTermMemory[chatId];
  const context = memory.get(chatId);
  context.push({ role: "user", content: userText });

  bot.sendChatAction(chatId, "typing");

  const history = summaryMemory[chatId]
    ? [
        { role: "system", content: `Память: ${summaryMemory[chatId]}` },
        ...context,
      ]
    : context;

  // const fullPrompt = userInfo
  //   ? `Пользователя зовут ${userInfo.name}. ${userText}`
  //   : userText;

  // context.push({ role: "user", content: fullPrompt });

  // if (context.length > 6) context.shift();

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

    if (context.length >= 10) {
      const summaryRes = await fetch(`${process.env.API_URL}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: context }),
      });
      const summaryData = await summaryRes.json();
      summaryMemory[chatId] = summaryData.summary;
      saveSummary(summaryMemory);

      // очищаем старую историю
      memory.set(chatId, []);
      bot.sendMessage(chatId, "💾 Обновил внутреннюю память диалога.");
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "🚨 Ошибка при обращении к серверу.");
  }
});

console.log("🤖 Бот с summary-памятью запущен!");
