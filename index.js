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
      messages: [
        { role: "system", content: "You are a helpful assistant." },
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

    res.json({ summaty: response.choices[0].message.content });
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
