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
      script: "icecast",
      args: "-c ./config/icecast.xml -b",
      interpreter: "none",
      env: {
        NODE_ENV: "development"
      }
    },
    {
      name: "liquidsoap",
      script: "liquidsoap",
      args: "-d ./config/radio.liq",
      interpreter: "none",
      env: {
        NODE_ENV: "development"
      }
    }
  ]
}