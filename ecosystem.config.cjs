module.exports = {
  apps: [
    {
      name: "ai-server-api",
      script: "index.js", // или твой стартовый файл
      cwd: "/root/ai-challenge",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ai-bot",
      script: "bot.js", // или твой файл бота
      cwd: "/root/ai-challenge",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
