#!/bin/bash
# PM2 服务管理快捷命令
# 使用方法:
#   ./scripts/pm2-commands.sh start    # 启动单体
#   ./scripts/pm2-commands.sh ms      # 启动微服务集群
#   ./scripts/pm2-commands.sh status  # 查看状态
#   ./scripts/pm2-commands.sh logs   # 查看日志
#   ./scripts/pm2-commands.sh stop    # 停止所有

COMMAND=$1
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT" || exit 1

case "$COMMAND" in
  start)
    echo "Starting monolith with PM2..."
    npx pm2 start ecosystem.microservices.config.js --only qianfu-monolith
    ;;
  ms)
    echo "Starting microservices cluster..."
    npx pm2 start ecosystem.microservices.config.js
    ;;
  status)
    npx pm2 list
    ;;
  logs)
    npx pm2 logs --lines 50
    ;;
  logs-err)
    npx pm2 logs --err --lines 50
    ;;
  restart)
    echo "Restarting all services..."
    npx pm2 restart all
    ;;
  stop)
    echo "Stopping all services..."
    npx pm2 delete all
    ;;
  mon)
    npx pm2 monit
    ;;
  reload)
    echo "Graceful reload all services..."
    npx pm2 reload all
    ;;
  info)
    echo "=== PM2 Info ==="
    npx pm2 --version
    echo ""
    echo "=== Service Status ==="
    npx pm2 list
    ;;
  *)
    echo "Usage: ./scripts/pm2-commands.sh {start|ms|status|logs|logs-err|restart|stop|mon|reload|info}"
    echo ""
    echo "Commands:"
    echo "  start   - 启动单体应用"
    echo "  ms      - 启动微服务集群"
    echo "  status  - 查看服务状态"
    echo "  logs    - 查看最近日志"
    echo "  logs-err - 查看错误日志"
    echo "  restart - 重启所有服务"
    echo "  stop    - 停止所有服务"
    echo "  mon     - 启动监控面板"
    echo "  reload  - 平滑重载所有服务"
    echo "  info    - 显示PM2信息和状态"
    ;;
esac
