import fs from "fs/promises";

const MEMORY_FILE = "./summaryMemory.json";

class MemoryStore {
  constructor() {
    this.data = new Map(); // chatId → conversation data
    this.lastSaved = null;
  }

  // Загрузить все данные из файла
  async load() {
    try {
      const fileContent = await fs.readFile(MEMORY_FILE, "utf8");
      const jsonData = JSON.parse(fileContent);

      // Преобразуем объект в Map
      this.data = new Map(Object.entries(jsonData));

      console.log(`💾 Загружено ${this.data.size} диалогов из памяти`);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("📝 Файл памяти не найден, создаем новый");
        this.data = new Map();
        return true;
      } else {
        console.error("❌ Ошибка загрузки памяти:", error);
        return false;
      }
    }
  }

  // Сохранить все данные в файл
  async save() {
    try {
      // Преобразуем Map в объект для JSON
      const jsonData = Object.fromEntries(this.data);
      console.log("💾 Сохраняем данные:", Object.keys(jsonData));
      const jsonString = JSON.stringify(jsonData, null, 2);

      // Атомарная запись: сначала во временный файл, потом переименование
      const tempFile = MEMORY_FILE + ".tmp";
      await fs.writeFile(tempFile, jsonString);
      await fs.rename(tempFile, MEMORY_FILE);

      this.lastSaved = new Date();
      console.log(`💾 Сохранено ${this.data.size} диалогов в память`);
      return true;
    } catch (error) {
      console.error("❌ Ошибка сохранения памяти:", error);
      return false;
    }
  }

  // Получить данные диалога
  getConversation(chatId) {
    return this.data.get(chatId.toString()) || null;
  }

  // Сохранить данные диалога
  setConversation(chatId, conversationData) {
    this.data.set(chatId.toString(), {
      ...conversationData,
      updatedAt: new Date().toISOString(),
    });
  }

  // Удалить диалог
  deleteConversation(chatId) {
    return this.data.delete(chatId.toString());
  }

  // Получить все диалоги
  getAllConversations() {
    return Object.fromEntries(this.data);
  }

  // Получить статистику памяти
  getMemoryStats() {
    return {
      totalConversations: this.data.size,
      lastSaved: this.lastSaved,
      memorySize: JSON.stringify(Object.fromEntries(this.data)).length,
    };
  }

  // Очистить всю память
  async clear() {
    this.data.clear();
    await this.save();
    console.log("🗑️ Память очищена");
  }

  // Graceful shutdown - сохранить перед выходом
  async shutdown() {
    console.log("🔄 Сохранение памяти перед выходом...");
    await this.save();
  }
}

// Экспортируем singleton instance
const memoryStore = new MemoryStore();
export default memoryStore;
