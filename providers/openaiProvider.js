//import dotenv from "dotenv";
import OpenAI from "openai";

// dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCompletion_OpenAI({ messages, format }) {
  const start = Date.now();
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

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: payload,
    max_completion_tokens: 2048,
  });

  const end = Date.now();
  const duration = ((end - start) / 1000).toFixed(2);

  const result = `🧠 Модель: gpt-4o-mini
⏱ Время: ${duration}s
🧮 Промпт токены: ${resp.usage?.prompt_tokens ?? "N/A"}
🧮 Сгенерированные токены: ${resp.usage?.completion_tokens ?? "N/A"}

💬 ${resp.choices[0].message.content}`;
  return result;
}
