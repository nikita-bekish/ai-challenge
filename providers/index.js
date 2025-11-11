import { generateCompletion_HuggingFaceRouter } from "./huggingfaceRouterProvider.js";
import { generateCompletion_OpenAI } from "./openaiProvider.js";
import { generateCompletion_Yandex } from "./yandexProvider.js";

export async function generateCompletion({ provider, messages, format }) {
  switch (provider) {
    case "yandex":
      return await generateCompletion_Yandex({ messages });
    case "huggingface":
      return await generateCompletion_HuggingFaceRouter({ messages });
    case "openai":
    default:
      return await generateCompletion_OpenAI({ messages, format });
  }
  if (provider === "yandex") {
    return await generateCompletion_Yandex({ messages });
  }
  return await generateCompletion_OpenAI({ messages, format });
}
