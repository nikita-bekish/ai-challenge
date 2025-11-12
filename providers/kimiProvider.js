//import dotenv from "dotenv";
import OpenAI from "openai";

//dotenv.config();

const hfClient = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_API_TOKEN,
});

/**
 * Универсальная функция генерации ответов через Hugging Face Router
 */
export async function generateCompletion_Kimi({ messages }) {
  const start = Date.now();

  try {
    const response = await hfClient.chat.completions.create({
      model: "moonshotai/Kimi-K2-Thinking:novita",
      temperature: 0.7,
      messages,
    });

    const end = Date.now();
    const duration = ((end - start) / 1000).toFixed(2);

    const answer = response.choices[0].message.content;
    const tokens = response.usage?.total_tokens ?? "N/A";

    const result = `🧠 Модель: moonshotai/Kimi-K2-Thinking:novita
⏱ Время: ${duration}s
🧮 Токены: ${tokens}

💬 ${answer}`;
    return result;
  } catch (error) {
    console.error("❌ Ошибка moonshotai/Kimi-K2-Thinking:", error.message);
    return `⚠️ Ошибка при обращении к moonshotai/Kimi-K2-Thinking`;
  }
}
