import dotenv from "dotenv";

dotenv.config();

export async function generateCompletion_Yandex({ messages }) {
  try {
    const response = await fetch(
      "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ⚠️ Если используешь IAM-токен
          Authorization: `Bearer ${process.env.IAM_TOKEN}`,
        },
        body: JSON.stringify({
          modelUri: process.env.MODEL_URI,
          completionOptions: {
            stream: false,
            temperature: 0.3,
            maxTokens: 500,
          },
          messages: messages.map((m) => ({
            role: m.role,
            text: m.content || m.text,
          })),
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("❌ Ошибка YandexGPT:", data.error);
      return "⚠️ Ошибка при обращении к YandexGPT.";
    }

    return (
      data.result?.alternatives?.[0]?.message?.text ||
      "⚠️ Нет ответа от YandexGPT."
    );
  } catch (err) {
    console.error("❌ Ошибка при вызове YandexGPT:", err);
    return "🚨 Ошибка при обращении к YandexGPT API.";
  }
}

// 🔥 День 4. Разные способы рассуждения

// - Возьмите простую задачу (желательно логическую или какую-то более-менее сложную)
// - Сначала попросите модель дать ответ напрямую
// - Затем в промпте добавьте инструкцию: «решай пошагово»
// - Затем попробуйте другой ИИ составить промпт для решения вашей задачи
// - Затем создайте внутри ИИ группу экспертов и попросите каждого из них дать решение вашей задачи

// Сравните, отличаются ли ответы и какой из них оказался правильнее

// Результат: Разные ответы от моделей и сравнение их результатов
// Формат: Видео
