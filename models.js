// benchmark.js (Node.js ≥18, ESM)
// Usage:
//   1) export HF_API_TOKEN="hf_..."
//   2) node benchmark.js
//
// Что делает:
// - Прогоняет единый PROMPT по трём моделям (top/mid/bottom)
// - Измеряет время, считает токены (через gpt-tokenizer, если установлен; иначе — эвристика)
// - Оценивает качество (простые эвристики: понятность/связность/креативность)
// - Считает стоимость, если указать цену за 1k токенов в конфиге MODELS (иначе 0)

import dotenv from "dotenv";
import { performance } from "node:perf_hooks";

dotenv.config();

// === Конфиг моделей ===
// Можно заменить/добавить модели. Если модель требует доступа/коммерческая — получите доступ в HF.
// const MODELS = [
//   // High-end / top-tier (часто доступ по запросу; замените при необходимости)
//   {
//     label: "top",
//     id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
//     pricePerKOutput: 0, // $ за 1000 выходных токенов (укажите, если у вас есть тариф)
//   },
//   // Mid-range open model
//   {
//     label: "mid",
//     id: "tiiuae/falcon-7b-instruct",
//     pricePerKOutput: 0,
//   },
//   // Bottom / small
//   {
//     label: "bottom",
//     id: "gpt2",
//     pricePerKOutput: 0,
//   },
// ];

const MODELS = [
  {
    label: "top",
    id: "meta-llama/Meta-Llama-3-8B-Instruct",
    pricePerKOutput: 0,
  },
  {
    label: "mid",
    id: "google/gemma-2b-it",
    pricePerKOutput: 0,
  },
  {
    label: "bottom",
    id: "distilgpt2",
    pricePerKOutput: 0,
  },
];

// === Единый промпт ===
const PROMPT =
  "Write a 3–5 sentence sci-fi story about a robot that suddenly became self-aware.";

// === Параметры генерации (унифицированно, где возможно) ===
const GENERATION_PARAMS = {
  max_new_tokens: 200,
  temperature: 0.7,
  // Для text-generation моделей у HF это часто работает:
  return_full_text: false,
};

// === Вспомогательная логика токенизации ===
// Попытка подключить gpt-tokenizer. Если нет — используем простую эвристику (~ 4 символа на токен).
let encode;
try {
  // npm i gpt-tokenizer
  const { encode: gptEncode } = await import("gpt-tokenizer");
  encode = (text) => gptEncode(text);
} catch {
  encode = (text) => {
    const clean = String(text ?? "").trim();
    if (!clean) return [];
    // простая оценка: 1 токен ≈ 4 символа
    const est = Math.max(1, Math.round(clean.length / 4));
    return Array.from({ length: est }, (_, i) => i);
  };
}
const countTokens = (text) => encode(text).length;

// === Простая оценка качества текста ===
// 0..10: усредняем три эвристики
function scoreQuality(text) {
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { clarity: 0, coherence: 0, creativity: 0, total: 0 };

  // Разбиение на предложения (очень грубо)
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  const words = t.toLowerCase().match(/[a-zA-Z]+(?:'[a-z]+)?/g) || [];
  const uniqueWords = new Set(words);

  // Clarity: предпочитаем среднюю длину предложения 8–25 слов
  const avgLen =
    sentences.reduce((sum, s) => sum + (s.split(/\s+/).length || 0), 0) /
    Math.max(1, sentences.length);
  let clarity = 10 - Math.abs(16 - avgLen); // пик около 16 слов
  clarity = Math.max(0, Math.min(10, clarity));

  // Coherence: штраф за повторяемость (чем меньше повторов — тем лучше)
  const repetitionRatio =
    words.length > 0 ? 1 - uniqueWords.size / words.length : 1;
  let coherence = 10 - repetitionRatio * 10; // 0..10
  coherence = Math.max(0, Math.min(10, coherence));

  // Creativity: чем выше доля уникальных слов, тем лучше (нормируем)
  const diversity = words.length > 0 ? uniqueWords.size / words.length : 0;
  let creativity = diversity * 12; // слегка щедро
  creativity = Math.max(0, Math.min(10, creativity));

  const total = Math.round(((clarity + coherence + creativity) / 3) * 10) / 10;
  return {
    clarity: Math.round(clarity * 10) / 10,
    coherence: Math.round(coherence * 10) / 10,
    creativity: Math.round(creativity * 10) / 10,
    total,
  };
}

// === Унифицированный вызов Inference API ===
async function callModel(modelId) {
  const url = `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(
    modelId
  )}`;

  const body = {
    inputs: PROMPT,
    parameters: GENERATION_PARAMS,
    options: {
      wait_for_model: true, // дождаться прогрева
      use_cache: false,
    },
  };

  const headers = {
    Authorization: `Bearer ${process.env.HF_API_TOKEN ?? ""}`,
    "Content-Type": "application/json",
  };

  const started = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const elapsedMs = performance.now() - started;

  if (res.status === 429) {
    throw new Error("429 Too Many Requests: вы попали под rate limit.");
  }
  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errTxt.slice(0, 500)}`);
  }

  const data = await res.json();

  // Возможные форматы:
  // 1) [{ generated_text: "..." }]
  // 2) { generated_text: "..." }
  // 3) { error: ... } (редко, но проверим)
  let text = "";
  if (Array.isArray(data) && data[0]?.generated_text) {
    text = data[0].generated_text;
  } else if (data?.generated_text) {
    text = data.generated_text;
  } else if (Array.isArray(data) && typeof data[0] === "string") {
    // некоторые модели возвращают просто строки
    text = data[0];
  } else if (typeof data === "string") {
    text = data;
  } else if (data?.error) {
    throw new Error(`Model error: ${data.error}`);
  } else {
    // На всякий случай попытаемся найти текст в известных местах
    const guess =
      data?.output_text || data?.outputs?.[0]?.content || data?.[0]?.text || "";
    text = String(guess);
  }

  return { text, elapsedMs };
}

// === Подсчёт стоимости (если указана цена за 1k выходных токенов) ===
function calcCost(outputTokens, pricePerKOutput) {
  if (!pricePerKOutput || outputTokens <= 0) return 0;
  return Math.round((outputTokens / 1000) * pricePerKOutput * 1e6) / 1e6;
}

// === Форматирование в Markdown-таблицу ===
function toMarkdownTable(rows) {
  const header =
    "| Model | Time (s) | Tokens (in/out) | Cost ($) | Quality (1–10) | Excerpt |\n" +
    "|------|---------:|-----------------:|---------:|---------------:|--------|\n";
  const lines = rows.map((r) => {
    const excerpt =
      r.text.replace(/\s+/g, " ").slice(0, 80) +
      (r.text.length > 80 ? "…" : "");
    return `| ${r.model} | ${r.timeSec.toFixed(2)} | ${r.tokensIn}/${
      r.tokensOut
    } | ${r.cost.toFixed(6)} | ${r.quality.toFixed(1)} | ${excerpt} |`;
  });
  return header + lines.join("\n");
}

// === Запуск бенчмарка ===
async function main() {
  const token = process.env.HF_API_TOKEN;
  if (!token) {
    console.error("❌ Set HF_API_TOKEN first: export HF_API_TOKEN='hf_xxx'");
    process.exit(1);
  }

  const results = [];

  for (const m of MODELS) {
    try {
      console.log(`\n▶️  Running: ${m.id} (${m.label})`);
      const inputTokens = countTokens(PROMPT);
      const { text, elapsedMs } = await callModel(m.id);
      const outputTokens = countTokens(text);
      const quality = scoreQuality(text).total;
      const cost = calcCost(outputTokens, m.pricePerKOutput);

      results.push({
        model: m.id,
        label: m.label,
        ms: Math.round(elapsedMs),
        timeSec: elapsedMs / 1000,
        tokensIn: inputTokens,
        tokensOut: outputTokens,
        cost,
        quality,
        text,
      });

      console.log(
        `   ✓ Done in ${Math.round(elapsedMs)} ms, outTokens=${outputTokens}`
      );
    } catch (e) {
      console.error(`   ✗ ${m.id} failed: ${e.message}`);
      results.push({
        model: m.id,
        label: m.label,
        ms: NaN,
        timeSec: NaN,
        tokensIn: countTokens(PROMPT),
        tokensOut: 0,
        cost: 0,
        quality: 0,
        text: "",
        error: e.message,
      });
    }

    // Небольшая пауза для вежливости к API
    await new Promise((r) => setTimeout(r, 500));
  }

  // Вывод таблицы
  console.log("\n=== Benchmark Results (Markdown) ===\n");
  console.log(toMarkdownTable(results));

  // Короткое резюме
  const ok = results.filter((r) => Number.isFinite(r.timeSec));
  if (ok.length) {
    const fastest = ok.reduce((a, b) => (a.timeSec < b.timeSec ? a : b));
    const bestQuality = ok.reduce((a, b) => (a.quality > b.quality ? a : b));

    console.log("\n--- Summary ---");
    console.log(`Fastest: ${fastest.model} (${fastest.timeSec.toFixed(2)} s)`);
    console.log(
      `Best quality: ${bestQuality.model} (${bestQuality.quality.toFixed(
        1
      )}/10)`
    );
    const paid = ok.filter((r) => r.cost > 0);
    if (paid.length) {
      const bestValue = paid.reduce((a, b) => {
        const av = a.quality / Math.max(0.000001, a.cost);
        const bv = b.quality / Math.max(0.000001, b.cost);
        return av > bv ? a : b;
      });
      console.log(
        `Best cost/quality: ${bestValue.model} ($${bestValue.cost.toFixed(
          6
        )} for ~${bestValue.tokensOut} out tok; ${bestValue.quality.toFixed(
          1
        )}/10)`
      );
    } else {
      console.log(
        "All models cost set to $0 in this run (free/open settings)."
      );
    }
  } else {
    console.log("No successful runs to summarize.");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
