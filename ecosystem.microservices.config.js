{
  "$schema": "https://json.schemastore.org/pm2-ecosystem",
  "apps": [
    {
      "name": "qianfu-monolith",
      "script": "dist-server/index.js",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3050",
        "SERVICE_NAME": "qianfu-monolith"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": "3050",
        "SERVICE_NAME": "qianfu-monolith"
      },
      "error_file": "logs/pm2-monolith-error.log",
      "out_file": "logs/pm2-monolith-out.log",
      "time": true,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "1G",
      "restart_delay": 4000,
      "node_args": "--max-old-space-size=1024 --expose-gc"
    },
    {
      "name": "qianfu-event-bus",
      "script": "services/event-bus/dist/index.js",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3060",
        "SERVICE_NAME": "qianfu-event-bus",
        "RABBITMQ_URL": "amqp://localhost:5672"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": "3060",
        "SERVICE_NAME": "qianfu-event-bus",
        "RABBITMQ_URL": "amqp://localhost:5672"
      },
      "error_file": "logs/pm2-event-bus-error.log",
      "out_file": "logs/pm2-event-bus-out.log",
      "time": true,
      "autorestart": true,
      "watch": false,
      "node_args": "--max-old-space-size=512"
    },
    {
      "name": "qianfu-user-service",
      "script": "services/user-service/dist/index.js",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3070",
        "SERVICE_NAME": "qianfu-user-service",
        "DATABASE_URL": "file:./dev.db",
        "EVENT_BUS_URL": "http://localhost:3060"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": "3070",
        "SERVICE_NAME": "qianfu-user-service",
        "DATABASE_URL": "file:./prod.db",
        "EVENT_BUS_URL": "http://localhost:3060"
      },
      "error_file": "logs/pm2-user-service-error.log",
      "out_file": "logs/pm2-user-service-out.log",
      "time": true,
      "autorestart": true,
      "watch": false,
      "node_args": "--max-old-space-size=512"
    },
    {
      "name": "qianfu-server-service",
      "script": "services/server-service/dist/index.js",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3071",
        "SERVICE_NAME": "qianfu-server-service",
        "DATABASE_URL": "file:./dev.db",
        "USER_SERVICE_URL": "http://localhost:3070"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": "3071",
        "SERVICE_NAME": "qianfu-server-service",
        "DATABASE_URL": "file:./prod.db",
        "USER_SERVICE_URL": "http://localhost:3070"
      },
      "error_file": "logs/pm2-server-service-error.log",
      "out_file": "logs/pm2-server-service-out.log",
      "time": true,
      "autorestart": true,
      "watch": false,
      "node_args": "--max-old-space-size=512"
    },
    {
      "name": "qianfu-payment-service",
      "script": "services/payment-service/dist/index.js",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3072",
        "SERVICE_NAME": "qianfu-payment-service",
        "DATABASE_URL": "file:./dev.db",
        "XPAY_API_KEY": "test_key",
        "XPAY_WEBHOOK_SECRET": "test_secret"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": "3072",
        "SERVICE_NAME": "qianfu-payment-service",
        "DATABASE_URL": "file:./prod.db"
      },
      "error_file": "logs/pm2-payment-service-error.log",
      "out_file": "logs/pm2-payment-service-out.log",
      "time": true,
      "autorestart": true,
      "watch": false,
      "node_args": "--max-old-space-size=512"
    }
  ]
}
