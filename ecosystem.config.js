module.exports = {
  apps : [{
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
  }]
}