{
  "$schema": "https://json.schemastore.org/pm2-ecosystem",
  "apps": [
    {
      "name": "qianfu",
      "script": "dist-server/index.js",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3000",
        "SERVICE_NAME": "qianfu"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": "3000",
        "SERVICE_NAME": "qianfu"
      },
      "error_file": "logs/pm2-error.log",
      "out_file": "logs/pm2-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "1G",
      "restart_delay": 4000,
      "node_args": "--max-old-space-size=1024 --expose-gc",
      "kill_timeout": 5000,
      "wait_ready": true,
      "listen_timeout": 3000
    }
  ]
}
