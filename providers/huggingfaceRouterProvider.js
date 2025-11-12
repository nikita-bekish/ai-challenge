import OpenAI from "openai";

const hfClient = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_API_TOKEN,
});

export async function generateCompletion_HuggingFaceRouter({ messages }) {
  const start = Date.now();

  try {
    const response = await hfClient.chat.completions.create({
      model: "HuggingFaceH4/zephyr-7b-beta",
      temperature: 0.7,
      messages,
    });

    const end = Date.now();
    const duration = ((end - start) / 1000).toFixed(2);

    const answer = response.choices[0].message.content;
    const tokens = response.usage?.total_tokens ?? "N/A";

    const result = `🧠 Модель: Xenova/gpt-3.5-turbo
                    ⏱ Время: ${duration}s
                    🧮 Токены: ${tokens}

                    💬 ${answer}
                    `;
    return result;
  } catch (error) {
    console.error("❌ Ошибка Xenova/gpt-3.5-turbo:", error.message);
    return `⚠️ Ошибка при обращении к Sao10K/L3-8B-Stheno-v3.2`;
  }
}
