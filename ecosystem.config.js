export default {
  apps: [
    {
      name: "nuar-crm-backend",
      cwd: "./backend",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      time: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
