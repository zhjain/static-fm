const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 读取 .env 文件
const envFile = path.resolve(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envFile));

module.exports = {
  apps: [
    {
      name: "static-fm",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "radio",
      script: "liquidsoap ./config/radio.liq",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
      env: envConfig ,
    }
  ],
};
