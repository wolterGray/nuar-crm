export default {
  apps: [
    {
      name: "nuar-backend",
      cwd: "./backend",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      time: true,
      max_memory_restart: "512M",
      kill_timeout: 12000,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
