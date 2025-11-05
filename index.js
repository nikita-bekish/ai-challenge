import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/ask", async (req, res) => {
  const { messages } = req.body;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a professional AI that always responds in strict JSON format.
Do not include explanations or markdown.
Always return a valid JSON object matching the user’s requested schema.
When you reply, return the result in the following JSON format: { "title": "string", "summary": "string", "key_points": ["string", "string", "string"] }
If you are unsure, key_points output an empty string "" or empty array [] for that field.
          `,
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

app.post("/summarize", async (req, res) => {
  const { history } = req.body;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты помогаешь создавать краткое резюме диалога. Обобщи ключевые факты, имена и темы без пересказа деталей.",
        },
        {
          role: "user",
          content: JSON.stringify(history),
        },
      ],
    });

    res.json({ summary: response.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка при сворачивании контекста" });
  }
});

app.get("/debug/memory", (req, res) => {
  try {
    const data = fs.readFileSync("./summaryMemory.json", "utf8");
    res.type("application/json").send(data);
  } catch (e) {
    res.status(500).send({ error: "Файл не найден или не читается" });
  }
});

app.listen(process.env.PORT, () =>
  console.log(`🚀 Сервер запущен на http://localhost:${process.env.PORT}`)
);
