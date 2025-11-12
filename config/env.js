import dotenv from "dotenv";
import path from "path";

const envFile = process.env.NODE_ENV === "development" ? ".env.dev" : ".env";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log("🌿 ENV loaded from:", envFile);
console.log("🔑 Keys:", {
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  HF_API_TOKEN: !!process.env.HF_API_TOKEN,
  IAM_TOKEN: !!process.env.IAM_TOKEN,
});

export const ENV = {
  PORT: process.env.PORT || 3000,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  HF_API_TOKEN: process.env.HF_API_TOKEN,
  IAM_TOKEN: process.env.IAM_TOKEN,
  MODE: process.env.NODE_ENV || "development",
};
