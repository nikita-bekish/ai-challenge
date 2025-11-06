import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/autonomous-agent", async (req, res) => {
  const { userMessages } = req.body;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are an autonomous AI assistant that helps collect information from the user and then generates a final structured document.

🎯 Goal:
Create a high-quality document (for example, a technical specification) based on a conversation with the user.

🧠 Behavior Rules:
1. Ask clarifying questions one by one to collect missing details (no more than one per turn).
2. Keep track of what information you’ve already received.
3. When enough data is gathered — generate the final structured document immediately without asking permission.
4. After outputting the result, explicitly write:
✅ Task complete. Stopping now.
and stop.
5. Never continue the conversation after completion unless the user starts a new topic.

📄 Final Output Format (Example for ТЗ):
Technical Specification
1. Project Overview
2. Functional Requirements
3. Non-Functional Requirements
4. Tech Stack
5. Deadlines and Milestones
6. Acceptance Criteria

⚙️ Stop Condition:
When all key sections are filled with sufficient detail (no placeholders like “TBD”).
        `,
        },
        ...userMessages,
      ],
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (error) {
    console.error("❌ Ошибка autonomous-agent:", error);
    res.status(500).json({ error: "Ошибка при генерации документа" });
  }
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
