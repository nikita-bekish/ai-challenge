import { InferenceClient } from "@huggingface/inference";
import chalk from "chalk";
import Table from "cli-table3";
import dotenv from "dotenv";

dotenv.config();

const hf = new InferenceClient(process.env.HF_TOKEN); // 🔑 токен с huggingface.co/settings/tokens

const prompt =
  "Придумай короткую научно-фантастическую историю (3–5 предложений) о человеке, который впервые встретил разумный ИИ.";

// const models = [
//   {
//     name: "Mistral-7B-Instruct-v0.3",
//     id: "mistralai/Mistral-7B-Instruct-v0.3",
//   },
//   {
//     name: "Falcon-7B-Instruct",
//     id: "tiiuae/falcon-7b-instruct",
//   },
//   {
//     name: "Flan-T5-Base",
//     id: "google/flan-t5-base",
//   },
// ];
const models = [
  {
    name: "Mixtral-8x7B-Instruct",
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
  },
  {
    name: "Phi-3-Mini-4K-Instruct",
    id: "microsoft/Phi-3-mini-4k-instruct",
  },
  {
    name: "TinyLlama-1.1B-Chat",
    id: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  },
];

const results = [];

for (const model of models) {
  console.log(chalk.blue(`\n🚀 Тестируем модель: ${model.name}...`));

  const start = Date.now();
  const response = await hf.textGeneration({
    model: model.id,
    inputs: prompt,
    provider: "hf-inference",
    parameters: { max_new_tokens: 150, temperature: 0.7 },
  });
  const end = Date.now();

  const elapsed = ((end - start) / 1000).toFixed(2);
  const text = response.generated_text;
  const tokens = text.split(/\s+/).length;

  console.log(chalk.green(`⏱ ${elapsed}s, ~${tokens} токенов`));
  console.log(chalk.gray(text));

  // Простейшая ручная оценка (можно потом заменить автоматической)
  let quality = 0;
  if (text.includes("ИИ") && text.length > 100) quality = 9;
  else if (text.length > 60) quality = 7;
  else quality = 5;

  results.push({
    Модель: model.name,
    "Время (сек)": elapsed,
    Токенов: tokens,
    Стоимость: "$0.0000",
    Качество: quality,
    Пример: text.slice(0, 80) + "...",
  });
}

// Таблица
const table = new Table({
  head: [
    "Модель",
    "Время (сек)",
    "Токенов",
    "Стоимость",
    "Качество (1–10)",
    "Пример ответа",
  ],
});

results.forEach((r) =>
  table.push([
    r.Модель,
    r["Время (сек)"],
    r.Токенов,
    r.Стоимость,
    r.Качество,
    r.Пример,
  ])
);

console.log(chalk.yellow("\n📊 Результаты сравнения:\n"));
console.log(table.toString());
