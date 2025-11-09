import "dotenv/config";
// import fetch from "node-fetch";

const IAM_TOKEN = process.env.IAM_TOKEN;
const FOLDER_ID = process.env.FOLDER_ID;

if (!IAM_TOKEN || !FOLDER_ID) {
  console.error("❌ Убедись, что в .env есть IAM_TOKEN и FOLDER_ID");
  process.exit(1);
}

console.log("modelUri:", `gpt://${FOLDER_ID}/yandexgpt-lite/latest`);

const url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

const payload = {
  modelUri: `gpt://${FOLDER_ID}/yandexgpt-lite/latest`,
  completionOptions: {
    temperature: 0.3,
    maxTokens: 100,
  },
  messages: [
    {
      role: "user",
      text: "Сгенерируй короткое приветствие от имени YandexGPT",
    },
  ],
};

const headers = {
  Authorization: `Bearer ${IAM_TOKEN}`,
  "x-folder-id": FOLDER_ID,
  "Content-Type": "application/json",
};

const res = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});

const data = await res.json();

if (!res.ok) {
  console.error("❌ Ошибка запроса:", data);
  process.exit(1);
}

console.log("✅ Ответ модели:");
console.log(data.result.alternatives[0].message.text);
