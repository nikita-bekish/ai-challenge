//import dotenv from "dotenv";
import * as tokenizer from "gpt-tokenizer";
import OpenAI from "openai";

// dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCompletion_OpenAI({ messages, format }) {
  const start = Date.now();

  // Подсчитываем токены входных сообщений
  const inputText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");
  const inputTokens = tokenizer.encode(inputText).length;

  const systemByFormat = {
    json: `You are a professional AI that always responds in strict JSON format.
Do not include explanations or markdown.
Return only a valid JSON object matching this schema:
{ "title": "string", "summary": "string", "key_points": ["string", "string", "string"] }`,
    markdown: `You are a professional AI that always responds in clean Markdown.
Format your answer as follows:

# {title}

**Summary:** {summary}

## Key Points
- {point1}
- {point2}
- {point3}

Do not include JSON or extra commentary.`,
  };

  const systemPrompt =
    format && (format === "json" || format === "markdown")
      ? systemByFormat[format]
      : null;

  const payload = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  // Подсчитываем токены system prompt если он есть
  let systemPromptTokens = 0;
  if (systemPrompt) {
    systemPromptTokens = tokenizer.encode(systemPrompt).length;
  }

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: payload,
    max_completion_tokens: 2048,
  });

  const end = Date.now();
  const duration = ((end - start) / 1000).toFixed(2);

  // Определяем, используется ли summary в диалоге
  const hasSummary = messages.some(
    (msg) =>
      msg.role === "system" &&
      msg.content.includes("Предыдущий контекст разговора (summary)")
  );
  const summaryStatus = hasSummary ? "📝 С SUMMARY" : "📋 БЕЗ SUMMARY";

  const totalInputTokens = inputTokens + systemPromptTokens;
  const openaiPromptTokens = resp.usage?.prompt_tokens ?? 0;
  const completionTokens = resp.usage?.completion_tokens ?? 0;

  const result = `${summaryStatus}
🧠 Модель: gpt-4o-mini
⏱ Время: ${duration}s

📊 СТАТИСТИКА ТОКЕНОВ:
  💭 Входные сообщения: ${inputTokens}
  🔧 System prompt: ${systemPromptTokens}
  📝 Общий вход: ${totalInputTokens}
  🧮 OpenAI промпт: ${openaiPromptTokens}
  ✍️ Сгенерированные: ${completionTokens}
  📈 Общий расход: ${openaiPromptTokens + completionTokens}

💬 ${resp.choices[0].message.content}`;
  return result;
}
