import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 [unhandledRejection] Необработанное исключение в промисе:");
  console.error(reason);
});

// Ошибки, которые не были пойманы (throw без try/catch)
process.on("uncaughtException", (err) => {
  console.error("💥 [uncaughtException] Необработанная ошибка:", err);
  // желательно завершать процесс, чтобы не зависнуть в невалидном состоянии
  process.exit(1);
});

// Ошибки из Node.js API (например, ECONNRESET)
process.on("uncaughtExceptionMonitor", (err) => {
  console.warn("⚠️ [uncaughtExceptionMonitor]:", err.message);
});

if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: ".env.dev" });
} else {
  dotenv.config();
}
//

console.log("🚀 Запуск бота в режиме:", process.env.MODE || "development");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const memory = new Map(); // хранит временную историю сообщений в рамках одного диалога
const userFormats = new Map(); // chatId → "json" | "markdown" | "default"
const userModes = new Map();
const userProviders = new Map(); // chatId → "openai" | "yandex" | "stheno"

bot.onText(/\/start/i, (msg) => {
  const chatId = msg.chat.id;
  const currentProvider = userProviders.get(chatId) || "openai";

  const welcomeMessage = `
👋 Привет! Я бот с двумя режимами:

1️⃣ *Обычный режим* — задавай вопросы, выбирай формат:
- /format json
- /format markdown
- /format default

2️⃣ *Режим ТЗ (/spec)* — создаёт структурированные документы (технические задания, спецификации и т.д.) с автоостановкой.

3. Проверка температуры. /temp

Сейчас активен *${currentProvider.toUpperCase()}*.\n\nВведите /provider, чтобы изменить.

Напиши /spec чтобы начать работу с ИИ-агентом для составления ТЗ.
`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
});

bot.onText(/\/spec/i, (msg) => {
  const chatId = msg.chat.id;
  userModes.set(chatId, "spec");
  bot.sendMessage(
    chatId,
    "📄 Режим ТЗ активирован. Опиши проект, а я соберу все детали и создам готовый документ.\n\nОтправь /exit чтобы выйти из этого режима."
  );
});

bot.onText(/\/temp/i, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "Сейчас LLM продемонстрирует влияние параметра температуры на генерируемые ответы."
  );
});

bot.onText(/\/exit/i, (msg) => {
  const chatId = msg.chat.id;
  userModes.set(chatId, "default");
  bot.sendMessage(chatId, "🚪 Возврат в обычный режим общения.");
});

bot.onText(/\/format(?:\s+(json|markdown|default))?/i, (msg, match) => {
  const chatId = msg.chat.id;
  const arg = match[1]?.toLowerCase();

  if (!arg) {
    const current = userFormats.get(chatId) || "default";
    return bot.sendMessage(
      chatId,
      `ℹ️ Текущий формат: *${current.toUpperCase()}*
Доступные варианты: /format json | /format markdown | /format default`,
      { parse_mode: "Markdown" }
    );
  }

  userFormats.set(chatId, arg);

  const human =
    arg === "json"
      ? "JSON (строгий)"
      : arg === "markdown"
      ? "Markdown"
      : "DEFAULT (свободный текст)";

  bot.sendMessage(chatId, `✅ Формат ответа установлен: *${human}*`, {
    parse_mode: "Markdown",
  });
});

bot.onText(/\/provider/i, (msg) => {
  const chatId = msg.chat.id;
  const current = userProviders.get(chatId) || "openai";

  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: current === "openai" ? "✅ OpenAI" : "OpenAI",
            callback_data: "set_provider_openai",
          },
          {
            text: current === "yandex" ? "✅ YandexGPT" : "YandexGPT",
            callback_data: "set_provider_yandex",
          },
          {
            text: current === "stheno" ? "✅ Stheno" : "Stheno",
            callback_data: "set_provider_stheno",
          },
          {
            text: current === "kimi" ? "✅ Kimi" : "Kimi",
            callback_data: "set_provider_kimi",
          },
        ],
      ],
    },
  };

  bot.sendMessage(
    chatId,
    `⚙️ Текущий провайдер: gi*${current.toUpperCase()}*`,
    {
      parse_mode: "Markdown",
      ...buttons,
    }
  );
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("set_provider_")) {
    const provider = data.replace("set_provider_", "");
    userProviders.set(chatId, provider);

    bot.answerCallbackQuery(query.id, {
      text: `Провайдер изменён: ${provider.toUpperCase()}`,
      show_alert: false,
    });

    const buttons = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: provider === "openai" ? "✅ OpenAI" : "OpenAI",
              callback_data: "set_provider_openai",
            },
            {
              text: provider === "yandex" ? "✅ YandexGPT" : "YandexGPT",
              callback_data: "set_provider_yandex",
            },
            {
              text: provider === "stheno" ? "✅ Stheno" : "Stheno",
              callback_data: "set_provider_stheno",
            },
            {
              text: provider === "kimi" ? "✅ Kimi" : "Kimi",
              callback_data: "set_provider_kimi",
            },
          ],
        ],
      },
    };

    bot.editMessageText(`⚙️ Текущий провайдер: *${provider.toUpperCase()}*`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: "Markdown",
      ...buttons,
    });
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text?.trim();

  if (
    !userText ||
    userText.startsWith("/format") ||
    userText.startsWith("/provider") ||
    userText.startsWith("/start") ||
    userText.startsWith("/spec") ||
    userText.startsWith("/exit")
  )
    return;

  const mode = userModes.get(chatId) || "default";
  bot.sendChatAction(chatId, "typing");

  if (userText.startsWith("/temp")) {
    try {
      const response = await fetch(`${process.env.API_URL}/temperature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({ userMessages: context }),
      });
      const data = await response.json();
      // const answer = data.answer || "⚠️ Нет ответа от модели";
      const rawAnswers = data.answer || {};
      let messageText = "";

      for (const [temp, text] of Object.entries(rawAnswers)) {
        messageText += `🔥 *Температура ${temp}*\n${text}\n\n`;
      }

      if (!messageText.trim()) {
        messageText = "⚠️ Нет ответа от модели";
      }
      bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "🚨 Ошибка при обращении к серверу.");
    }

    return;
  }

  if (mode === "spec") {
    // =========================
    // РЕЖИМ СОСТАВЛЕНИЯ ТЗ
    // =========================
    const context = memory.get(chatId) || [];
    context.push({ role: "user", content: userText });
    memory.set(chatId, context);

    try {
      const response = await fetch(`${process.env.API_URL}/autonomous-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessages: context }),
      });
      const data = await response.json();
      const answer = data.answer || "⚠️ Нет ответа от модели";

      bot.sendMessage(chatId, answer);

      // если агент завершил работу — сбрасываем режим
      if (answer.includes("✅ Task complete. Stopping now")) {
        userModes.set(chatId, "default");
        memory.delete(chatId);
      }
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "🚨 Ошибка при обращении к серверу.");
    }

    return;
  }

  // =========================
  // ОБЫЧНЫЙ РЕЖИМ
  // =========================

  if (!memory.has(chatId)) memory.set(chatId, []);
  const context = memory.get(chatId);
  context.push({ role: "user", content: userText });

  const rawFormat = userFormats.get(chatId) || "default";
  const format =
    rawFormat === "json" || rawFormat === "markdown" ? rawFormat : null;
  const provider = userProviders.get(chatId) || "openai";

  try {
    const response = await fetch(`${process.env.API_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: context, format, provider }),
    });

    const data = await response.json();
    const answer = data.answer || "⚠️ Нет ответа от модели";
    console.log("nik answer", answer);

    // bot.sendMessage(chatId, answer, {
    //   parse_mode: format === "markdown" ? "Markdown" : undefined,
    // });
    safeSend(bot, chatId, answer, { parse_mode: "Markdown" });

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

console.log("🤖 Бот с режимом ТЗ запущен!");

function safeSend(bot, chatId, message, options = {}) {
  if (!message || typeof message !== "string" || !message.trim()) {
    console.error("⚠️ Пустое сообщение в safeSend:", message);
    return bot.sendMessage(
      chatId,
      "⚠️ Ошибка: пустой ответ или неверный формат."
    );
  }

  if (message.length > 4000) {
    message =
      message.slice(0, 3900) + "\n\n⚠️ Ответ сокращён (слишком длинный)";
  }

  try {
    return bot.sendMessage(chatId, message, options);
  } catch (err) {
    console.error("❌ Ошибка при отправке в Telegram:", err.message);
    console.log("➡️ Исходное сообщение:", message);
  }
}
