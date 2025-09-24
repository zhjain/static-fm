module.exports = {
  apps : [
    {
      name   : "static-fm",
      script : "./server.js",
      instances : 1,
      exec_mode : "fork",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production : {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "icecast",
      script: "which icecast",
      args: "",
      interpreter: "sh",
      env: {
        NODE_ENV: "development"
      },
      // 使用shell脚本启动icecast
      execute_command: "icecast -c ./config/icecast.xml -b"
    },
    {
      name: "liquidsoap",
      script: "which liquidsoap",
      args: "",
      interpreter: "sh",
      env: {
        NODE_ENV: "development"
      },
      // 使用shell脚本启动liquidsoap
      execute_command: "liquidsoap -d ./config/radio.liq"
    }
  ]
}