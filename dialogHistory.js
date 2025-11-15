import dotenv from "dotenv";
import OpenAI from "openai";
import memoryStore from "./memoryStore.js";

if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: ".env.dev" });
} else {
  dotenv.config();
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class DialogHistory {
  constructor({
    maxMessagesBeforeSummary = 5, // Порог для создания summary
    keepLastMessages = 2, // Сколько сообщений оставлять после summary
    autoSave = true, // Автоматически сохранять изменения
  } = {}) {
    this.conversations = new Map(); // chatId → { messages, summary, messageCount }
    this.maxMessagesBeforeSummary = maxMessagesBeforeSummary;
    this.keepLastMessages = keepLastMessages;
    this.autoSave = autoSave;
    this.initialized = false; // Флаг готовности

    // Инициализируем асинхронно
    this.initialize();
  }

  // Асинхронная инициализация
  async initialize() {
    try {
      await this.loadFromMemory();
      this.initialized = true;
      console.log("✅ DialogHistory готов к работе");
    } catch (error) {
      console.error("❌ Ошибка инициализации DialogHistory:", error);
      this.initialized = true; // Продолжаем работу даже с ошибкой
    }
  }

  // Загрузить данные из внешней памяти
  async loadFromMemory() {
    try {
      await memoryStore.load();
      const allConversations = memoryStore.getAllConversations();

      console.log(`🔍 Загружаем данные из памяти:`, allConversations);

      // Восстанавливаем данные из memoryStore
      for (const [chatId, data] of Object.entries(allConversations)) {
        console.log(`🔄 Восстанавливаем chat ${chatId}:`, {
          messages: data.messages?.length || 0,
          hasSummary: !!data.summary,
          messageCount: data.messageCount,
        });

        this.conversations.set(chatId, {
          messages: data.messages || [],
          summary: data.summary || null,
          messageCount: data.messageCount || 0,
        });
      }

      console.log(
        `💾 DialogHistory: Загружено ${this.conversations.size} диалогов из памяти`
      );
    } catch (error) {
      console.error("❌ Ошибка загрузки из памяти:", error);
    }
  }

  // Сохранить данные во внешнюю память
  async saveToMemory(chatId) {
    if (!this.autoSave) return;

    try {
      const conversation = this.conversations.get(chatId);
      if (conversation) {
        memoryStore.setConversation(chatId, conversation);
        // Не сохраняем каждый раз, чтобы не перегружать файловую систему
        // Сохраняем только summary или каждые N сообщений
      }
    } catch (error) {
      console.error("❌ Ошибка сохранения в память:", error);
    }
  }

  // Добавить сообщение пользователя
  addUserMessage(chatId, message) {
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, {
        messages: [],
        summary: null,
        messageCount: 0,
      });
    }

    const conversation = this.conversations.get(chatId);
    conversation.messages.push({ role: "user", content: message });
    conversation.messageCount++;

    // Сохраняем изменения в память
    this.saveToMemory(chatId);

    return this.shouldCreateSummary(chatId);
  }

  // Добавить ответ ассистента
  addAssistantMessage(chatId, message) {
    const conversation = this.conversations.get(chatId);
    if (conversation) {
      conversation.messages.push({ role: "assistant", content: message });
      // Сохраняем изменения в память
      this.saveToMemory(chatId);
    }
  }

  // Проверить, нужно ли создать summary
  shouldCreateSummary(chatId) {
    const conversation = this.conversations.get(chatId);
    return (
      conversation && conversation.messageCount >= this.maxMessagesBeforeSummary
    );
  }

  // Создать summary и очистить историю
  async createSummary(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) return null;

    try {
      // Формируем промпт для summary
      const messagesForSummary = [
        {
          role: "system",
          content: `Ты - эксперт по созданию кратких содержательных резюме диалогов. 
          
Создай структурированное summary диалога, которое включает:

🎯 ЦЕЛЬ ДИАЛОГА: Основная тема или задача разговора
📋 КЛЮЧЕВЫЕ ФАКТЫ: Важная информация, которую сообщили участники
❓ НЕЗАКРЫТЫЕ ВОПРОСЫ: Что еще нужно обсудить или решить
💡 ПРИНЯТЫЕ РЕШЕНИЯ: О чем договорились или что выяснили

Пиши кратко и по сути. Max 100-150 слов.`,
        },
        {
          role: "user",
          content: `Создай summary этого диалога:\n\n${this.formatMessagesForSummary(
            conversation.messages
          )}`,
        },
      ];

      // Отправляем запрос в OpenAI
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1, // Низкая температура для консистентности
        messages: messagesForSummary,
        max_completion_tokens: 500,
      });

      const summary = response.choices[0].message.content.trim();

      // Сохраняем summary и очищаем историю
      conversation.summary = summary;

      // Оставляем только последние сообщения
      const lastMessages = conversation.messages.slice(-this.keepLastMessages);
      conversation.messages = lastMessages;
      conversation.messageCount = lastMessages.length; // Обновляем счетчик

      console.log(
        `📝 Summary created for chat ${chatId}: ${summary.substring(0, 100)}...`
      );

      // Принудительно сохраняем summary в память
      await memoryStore.setConversation(chatId, conversation);
      await memoryStore.save(); // Сразу сохраняем файл

      console.log(`💾 Summary сохранен в память для chat ${chatId}`);

      return summary;
    } catch (error) {
      console.error("❌ Error creating summary:", error);
      return null;
    }
  }

  // Форматировать сообщения для summary промпта
  formatMessagesForSummary(messages) {
    return messages
      .map((msg) => {
        const role = msg.role === "user" ? "👤 Пользователь" : "🤖 Ассистент";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");
  }

  // Получить контекст для отправки в OpenAI
  getContextForOpenAI(chatId) {
    // Проверяем, что данные загружены
    if (!this.initialized) {
      console.warn(
        "⚠️ DialogHistory еще инициализируется, данные могут быть неполными"
      );
    }

    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      console.log(`🔍 Нет данных для chat ${chatId}`);
      return [];
    }

    const context = [];

    // Детальное логирование данных диалога
    console.log(`🔍 Данные для chat ${chatId}:`);
    console.log(`  - messages: ${conversation.messages?.length || 0}`);
    console.log(`  - summary: ${conversation.summary ? "ЕСТЬ" : "НЕТ"}`);
    console.log(`  - messageCount: ${conversation.messageCount}`);

    // Если есть summary, добавляем его как system message
    if (conversation.summary) {
      console.log(`📝 Summary: ${conversation.summary.substring(0, 100)}...`);
      context.push({
        role: "system",
        content: `Предыдущий контекст разговора (summary): ${conversation.summary}

Используй эту информацию для понимания контекста, но отвечай на текущий вопрос пользователя.`,
      });
    }

    // Добавляем оставшиеся сообщения
    if (conversation.messages && conversation.messages.length > 0) {
      console.log(`💬 Последние сообщения: ${conversation.messages.length}`);
      conversation.messages.forEach((msg, index) => {
        console.log(
          `  ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`
        );
      });
      context.push(...conversation.messages);
    }

    console.log(`📤 Отправляем в OpenAI: ${context.length} сообщений`);

    return context;
  }

  // Получить статистику диалога
  getStats(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) return null;

    return {
      messageCount: conversation.messageCount,
      hasSummary: !!conversation.summary,
      messagesLength: conversation.messages.length,
      summaryLength: conversation.summary ? conversation.summary.length : 0,
    };
  }

  // Очистить диалог (для тестирования)
  clearConversation(chatId) {
    this.conversations.delete(chatId);
    // Удаляем из внешней памяти
    memoryStore.deleteConversation(chatId);
  }

  // Получить все диалоги (для отладки)
  getAllConversations() {
    return Object.fromEntries(this.conversations);
  }

  // Получить статистику памяти
  getMemoryStats() {
    const memoryStats = memoryStore.getMemoryStats();
    return {
      ...memoryStats,
      activeConversations: this.conversations.size,
      autoSave: this.autoSave,
    };
  }

  // Graceful shutdown - сохранить все данные перед выходом
  async shutdown() {
    console.log("🔄 DialogHistory: Сохранение всех данных перед выходом...");

    try {
      // Сохраняем все активные диалоги
      for (const [chatId, conversation] of this.conversations) {
        memoryStore.setConversation(chatId, conversation);
      }

      // Сохраняем файл
      await memoryStore.save();
      console.log("✅ DialogHistory: Все данные сохранены");
    } catch (error) {
      console.error("❌ Ошибка при shutdown DialogHistory:", error);
    }
  }
}

export default DialogHistory;
