module.exports = {
  apps: [
    {
      name: 'qianfu-api',
      script: 'dist-server/server/index.js',
      cwd: '/www/wwwroot/qianfu-app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      error_file: '/www/wwwroot/qianfu-app/logs/pm2-error.log',
      out_file: '/www/wwwroot/qianfu-app/logs/pm2-out.log',
      log_file: '/www/wwwroot/qianfu-app/logs/pm2-combined.log',
      time: true,
    },
  ],
};
