import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/ask", async (req, res) => {
  const { messages, format = "json" } = req.body;

  console.log("🔍 Формат ответа:", format, "messages:", messages);

  const systemPrompts = {
    json: `
You are a professional AI that always responds in strict JSON format.
Do not include explanations or markdown.
Return only a valid JSON object matching this schema:
{ "title": "string", "summary": "string", "key_points": ["string", "string", "string"] }
    `,
    markdown: `
You are a professional AI that always responds in clean Markdown.
Format your answer as follows:

# {title}

**Summary:** {summary}

## Key Points
- {point1}
- {point2}
- {point3}

Do not include JSON or extra commentary.
    `,
  };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: systemPrompts[format] || systemPrompts.json,
        },
        ...messages,
      ],
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка при обращении к OpenAI API" });
  }
});

app.listen(process.env.PORT, () =>
  console.log(`🚀 Сервер запущен на http://localhost:${process.env.PORT}`)
);
