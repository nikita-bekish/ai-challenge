import { InferenceClient } from "@huggingface/inference";
import dotenv from "dotenv";

dotenv.config();
const client = new InferenceClient(process.env.HF_API_TOKEN);

const chatCompletion = await client.chatCompletion({
  model: "openai/gpt-oss-120b:fastest",
  messages: [
    {
      role: "user",
      content: "How many 'G's in 'huggingface'?",
    },
  ],
});

// console.log(chatCompletion.choices[0].message);

await client.chatCompletion({
  model: "deepseek-ai/DeepSeek-R1:fastest",
  provider: "sambanova", // Specific provider
  messages: [{ role: "user", content: "Hello!" }],
});

// Automatic provider selection (default: "auto")
await client.chatCompletion({
  model: "deepseek-ai/DeepSeek-R1",
  // Defaults to "auto" selection of the provider
  // provider="auto",
  messages: [{ role: "user", content: "Hello!" }],
});

// curl https://router.huggingface.co/v1/chat/completions \
//   -H "Authorization: Bearer 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" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "model": "deepseek-ai/DeepSeek-R1:fastest",
//     "messages": [
//       {
//         "role": "user",
//         "content": "Hello!"
//       }
//     ]
//   }'
