import { generateCompletion_HuggingFaceRouter } from "./huggingfaceRouterProvider.js";
import { generateCompletion_Kimi } from "./kimiProvider.js";
import { generateCompletion_OpenAI } from "./openaiProvider.js";
import { generateCompletion_Yandex } from "./yandexProvider.js";

export async function generateCompletion({ provider, messages, format }) {
  switch (provider) {
    case "yandex":
      return await generateCompletion_Yandex({ messages });
    case "stheno":
      return await generateCompletion_HuggingFaceRouter({ messages });
    case "kimi":
      return await generateCompletion_Kimi({ messages });
    case "openai":
    default:
      return await generateCompletion_OpenAI({ messages, format });
  }
}
