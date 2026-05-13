#!/bin/bash

# XPay 停止脚本

PID_FILE="/opt/xpay-3.1/xpay-code/app.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "XPay 未运行或 PID 文件不存在"
    exit 1
fi

PID=$(cat $PID_FILE)

if ps -p $PID > /dev/null 2>&1; then
    echo "正在停止 XPay (PID: $PID)..."
    kill $PID
    
    # 等待进程停止
    for i in {1..30}; do
        if ! ps -p $PID > /dev/null 2>&1; then
            echo "XPay 已停止"
            rm -f $PID_FILE
            exit 0
        fi
        sleep 1
    done
    
    # 如果进程还未停止，强制杀死
    echo "等待超时，强制杀死进程..."
    kill -9 $PID
    rm -f $PID_FILE
    echo "XPay 已强制停止"
else
    echo "XPay 未运行 (PID 文件过期)"
    rm -f $PID_FILE
fi
