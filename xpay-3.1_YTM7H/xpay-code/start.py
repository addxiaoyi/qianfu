#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StarMC Payment System - 启动脚本
自动检测环境并启动项目
"""

import os
import sys
import socket
import subprocess
import time
import signal
from pathlib import Path

class_colors = {
    'header': '\033[95m',
    'okblue': '\033[94m',
    'okgreen': '\033[92m',
    'warning': '\033[93m',
    'fail': '\033[91m',
    'endc': '\033[0m',
    'bold': '\033[1m',
    'cyan': '\033[96m'
}

SERVER_PROCESS = None
SCRIPT_DIR = Path(__file__).parent.absolute()

def log(msg, level="INFO"):
    colors = {
        "INFO": class_colors['okblue'],
        "OK": class_colors['okgreen'],
        "WARN": class_colors['warning'],
        "FAIL": class_colors['fail'],
        "STEP": class_colors['cyan']
    }
    color = colors.get(level, class_colors['endc'])
    prefix = {
        "INFO": "[INFO]",
        "OK": "[OK]",
        "WARN": "[WARN]",
        "FAIL": "[FAIL]",
        "STEP": "[STEP]"
    }
    print(f"{color}{prefix.get(level, '[INFO]')}{class_colors['endc']} {msg}")

def log_header(msg):
    print(f"\n{class_colors['bold']}{class_colors['header']}{'='*60}{class_colors['endc']}")
    print(f"{class_colors['bold']}{class_colors['header']}{msg}{class_colors['endc']}")
    print(f"{class_colors['bold']}{class_colors['header']}{'='*60}{class_colors['endc']}\n")

def check_java():
    try:
        result = subprocess.run(['java', '-version'], capture_output=True, text=True)
        version_line = result.stderr.split('\n')[0] if result.stderr else result.stdout.split('\n')[0]
        version = version_line.split('"')[1] if '"' in version_line else 'unknown'
        major_version = int(version.split('.')[0]) if version != 'unknown' and version.split('.')[0].isdigit() else 0
        log(f"Java 版本: {version}", "OK")
        return major_version >= 8
    except:
        return False

def check_port(host, port, timeout=2):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def wait_for_service(host, port, timeout=120):
    log(f"等待服务 {host}:{port} 就绪...", "INFO")
    start_time = time.time()
    while time.time() - start_time < timeout:
        if check_port(host, port):
            log(f"服务 {host}:{port} 已就绪", "OK")
            return True
        time.sleep(2)
    return False

def is_mysql_running():
    return check_port('127.0.0.1', 3306) or check_port('localhost', 3306)

def is_redis_running():
    return check_port('127.0.0.1', 6379) or check_port('localhost', 6379)

def find_jar():
    jar_files = list(SCRIPT_DIR.glob('target/*.jar'))
    if jar_files:
        return jar_files[0]
    return None

def start_spring_boot():
    global SERVER_PROCESS

    jar_path = find_jar()
    if not jar_path:
        log("未找到 JAR 文件，请先运行: python install.py", "FAIL")
        return None

    log(f"启动 JAR: {jar_path.name}", "STEP")

    try:
        SERVER_PROCESS = subprocess.Popen(
            [sys.executable, '-jar', str(jar_path.absolute())],
            cwd=SCRIPT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return SERVER_PROCESS
    except Exception as e:
        log(f"启动失败: {e}", "FAIL")
        return None

def signal_handler(sig, frame):
    global SERVER_PROCESS
    log("\n接收到停止信号，正在关闭服务器...", "INFO")
    if SERVER_PROCESS:
        SERVER_PROCESS.terminate()
        try:
            SERVER_PROCESS.wait(timeout=10)
        except:
            SERVER_PROCESS.kill()
    sys.exit(0)

def main():
    global SERVER_PROCESS

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    log_header("StarMC 智能启动系统 v3.1")

    log("检查 Java 环境...", "STEP")
    if not check_java():
        log("Java 环境异常，请安装 JDK 8+", "FAIL")
        sys.exit(1)

    log("检查 MySQL 服务...", "STEP")
    if not is_mysql_running():
        log("MySQL 未运行 - 请先启动 MySQL", "WARN")

    log("检查 Redis 服务...", "STEP")
    if not is_redis_running():
        log("Redis 未运行 - 请先启动 Redis", "WARN")

    log("启动 Spring Boot 应用...", "STEP")
    process = start_spring_boot()

    if process:
        log("等待应用启动...", "INFO")
        if wait_for_service('127.0.0.1', 8888, timeout=120):
            log_header("StarMC 支付系统启动成功!")
            log("访问地址: http://localhost:8888", "OK")
            log("支付页面: http://localhost:8888/starmc/pay", "OK")
            log("管理后台: http://localhost:8888/starmc/settings", "OK")
            log("\n按 Ctrl+C 停止服务", "INFO")

            try:
                while True:
                    if process.poll() is not None:
                        log("服务器进程已退出", "FAIL")
                        break
                    time.sleep(5)
            except KeyboardInterrupt:
                signal_handler(None, None)
        else:
            log("服务启动超时", "FAIL")
            if process:
                process.terminate()
    else:
        log("无法启动服务", "FAIL")
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"启动异常: {e}", "FAIL")
        sys.exit(1)
