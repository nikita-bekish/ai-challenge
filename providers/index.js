import { generateCompletion_OpenAI } from "./openaiProvider.js";
import { generateCompletion_Yandex } from "./yandexProvider.js";

export async function generateCompletion({ provider, messages, format }) {
  if (provider === "yandex") {
    return await generateCompletion_Yandex({ messages });
  }
  return await generateCompletion_OpenAI({ messages, format });
}
