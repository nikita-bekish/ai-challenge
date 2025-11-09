import fs from "fs";
import jwt from "jsonwebtoken";
// import fetch from "node-fetch"; // или просто fetch в Node 18+

// Читаем key.json (файл ключа сервисного аккаунта)
const key = JSON.parse(fs.readFileSync("key.json", "utf8"));

const now = Math.floor(Date.now() / 1000);

// Формируем payload для JWT
const payload = {
  aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens",
  iss: key.service_account_id,
  iat: now,
  exp: now + 360, // токен действителен ~6 минут, достаточно для запроса
};

// Подписываем JWT приватным ключом из key.json
const jwtToken = jwt.sign(payload, key.private_key, {
  algorithm: "PS256",
  header: {
    kid: key.id,
  },
});

// Отправляем запрос на получение IAM-токена
const res = await fetch("https://iam.api.cloud.yandex.net/iam/v1/tokens", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jwt: jwtToken }),
});

const data = await res.json();

if (!res.ok) {
  console.error("Ошибка:", data);
  process.exit(1);
}

console.log("✅ IAM_TOKEN:", data.iamToken);
console.log("⏳ Истекает:", data.expiresAt);
