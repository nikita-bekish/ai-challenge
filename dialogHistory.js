import dotenv from "dotenv";
import OpenAI from "openai";

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
  } = {}) {
    this.conversations = new Map(); // chatId → { messages, summary, messageCount }
    this.maxMessagesBeforeSummary = maxMessagesBeforeSummary;
    this.keepLastMessages = keepLastMessages;
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

    return this.shouldCreateSummary(chatId);
  }

  // Добавить ответ ассистента
  addAssistantMessage(chatId, message) {
    const conversation = this.conversations.get(chatId);
    if (conversation) {
      conversation.messages.push({ role: "assistant", content: message });
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
    const conversation = this.conversations.get(chatId);
    if (!conversation) return [];

    const context = [];

    // Если есть summary, добавляем его как system message
    if (conversation.summary) {
      context.push({
        role: "system",
        content: `Предыдущий контекст разговора (summary): ${conversation.summary}

Используй эту информацию для понимания контекста, но отвечай на текущий вопрос пользователя.`,
      });
    }

    // Добавляем оставшиеся сообщения
    context.push(...conversation.messages);

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
  }

  // Получить все диалоги (для отладки)
  getAllConversations() {
    return Object.fromEntries(this.conversations);
  }
}

export default DialogHistory;
