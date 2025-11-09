import TelegramBot from "node-telegram-bot-api";

// if (process.env.NODE_ENV === "production") {
//   dotenv.config({ path: ".env.prod" });
// } else {
//   dotenv.config({ path: ".env.dev" });
// }

console.log("🚀 Запуск бота в режиме:", process.env.MODE || "development");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const memory = new Map(); // хранит временную историю сообщений в рамках одного диалога
const userFormats = new Map(); // chatId → "json" | "markdown" | "default"
const userModes = new Map();
const userProviders = new Map(); // chatId → "openai" | "yandex"

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
            text: current === "openai" ? "✅ OpenAI (активен)" : "OpenAI",
            callback_data: "set_provider_openai",
          },
          {
            text: current === "yandex" ? "✅ YandexGPT (активен)" : "YandexGPT",
            callback_data: "set_provider_yandex",
          },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, `⚙️ Текущий провайдер: *${current.toUpperCase()}*`, {
    parse_mode: "Markdown",
    ...buttons,
  });
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "set_provider_openai" || data === "set_provider_yandex") {
    const provider = data.includes("openai") ? "openai" : "yandex";
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
              text: provider === "openai" ? "✅ OpenAI (активен)" : "OpenAI",
              callback_data: "set_provider_openai",
            },
            {
              text:
                provider === "yandex" ? "✅ YandexGPT (активен)" : "YandexGPT",
              callback_data: "set_provider_yandex",
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

console.log("🤖 Бот с режимом ТЗ запущен!");
