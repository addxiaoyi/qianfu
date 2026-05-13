#!/bin/bash
# =================================================================
# StarMC Payment System - 智能端口清理与进程管理脚本
# 版本: 3.1
# 平台: Linux (主流发行版)
# =================================================================

set -e

APP_NAME="xpay"
APP_PORT=${APP_PORT:-8888}
LOG_FILE="/var/log/starmc-portclean.log"
PID_FILE="/var/run/starmc-${APP_PORT}.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; echo "[OK] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_header() { echo -e "\n${CYAN}============================================================${NC}\n${CYAN}$1${NC}\n${CYAN}============================================================${NC}\n"; }

need_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此操作需要 root 权限"
        exit 1
    fi
}

detect_os() {
    if [[ -f /etc/redhat-release ]]; then
        echo "rhel"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    elif [[ -f /etc/arch-release ]]; then
        echo "arch"
    elif [[ -f /etc/SuSE-release ]]; then
        echo "suse"
    elif [[ -f /etc/alpine-release ]]; then
        echo "alpine"
    else
        echo "unknown"
    fi
}

check_port() {
    local port=$1
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        return 0
    elif netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
        return 0
    fi
    return 1
}

get_port_process() {
    local port=$1
    local info=""

    if command -v ss &>/dev/null; then
        info=$(ss -tlnp 2>/dev/null | grep ":${port} " || true)
    elif command -v netstat &>/dev/null; then
        info=$(netstat -tlnp 2>/dev/null | grep ":${port} " || true)
    fi

    if [[ -n "$info" ]]; then
        echo "$info" | awk '{print $NF}' | sed -r 's/.*pid=([0-9]+).*/\1/' | head -1
    fi
}

get_process_name() {
    local pid=$1
    if [[ -f "/proc/$pid/comm" ]]; then
        cat "/proc/$pid/comm" 2>/dev/null
    fi
}

get_process_cmdline() {
    local pid=$1
    if [[ -f "/proc/$pid/cmdline" ]]; then
        tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | sed 's/ $//'
    fi
}

list_port_usage() {
    log_header "端口 ${APP_PORT} 使用情况"

    if check_port "$APP_PORT"; then
        local pid=$(get_port_process "$APP_PORT")
        local pname=$(get_process_name "$pid")
        local cmdline=$(get_process_cmdline "$pid")

        echo -e "${YELLOW}端口 ${APP_PORT} 正被占用:${NC}"
        echo "  PID:        $pid"
        echo "  进程名:     $pname"
        echo "  命令行:     $cmdline"

        log "端口 ${APP_PORT} 被 PID $pid ($pname) 占用"
    else
        log_ok "端口 ${APP_PORT} 可用"
    fi
}

force_kill_port() {
    local port=$1
    local signal=${2:-TERM}

    need_root

    if ! check_port "$port"; then
        log_ok "端口 $port 空闲，无需清理"
        return 0
    fi

    log "正在清理端口 $port ..."

    local pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | sed -r 's/.*pid=([0-9]+).*/\1/' | sort -u)

    if [[ -z "$pids" ]]; then
        pids=$(netstat -tlnp 2>/dev/null | grep ":${port} " | sed -r 's/.*pid=([0-9]+).*/\1/' | sort -u)
    fi

    for pid in $pids; do
        if [[ -n "$pid" && "$pid" =~ ^[0-9]+$ ]]; then
            local pname=$(get_process_name "$pid")
            log "发送 ${signal} 信号到 PID $pid ($pname)..."

            kill -${signal} "$pid" 2>/dev/null || true

            sleep 1

            if kill -0 "$pid" 2>/dev/null; then
                log_warn "进程未响应，发送 KILL 信号..."
                kill -KILL "$pid" 2>/dev/null || true
                sleep 1
            fi

            if kill -0 "$pid" 2>/dev/null; then
                log_error "无法终止 PID $pid"
            else
                log_ok "已终止 PID $pid ($pname)"
            fi
        fi
    done

    sleep 2

    if check_port "$port"; then
        log_error "端口清理失败"
        return 1
    else
        log_ok "端口 $port 清理完成"
        return 0
    fi
}

smart_clean() {
    log_header "智能端口清理"

    if ! check_port "$APP_PORT"; then
        log_ok "端口 ${APP_PORT} 空闲，无需清理"
        return 0
    fi

    local pid=$(get_port_process "$APP_PORT")
    local pname=$(get_process_name "$pid")

    log "检测到端口 ${APP_PORT} 被占用")
    echo "  PID:     $pid"
    echo "  进程名:  $pname"

    if [[ "$pname" == "java" || "$pname" == "python"* || "$pname" == "${APP_NAME}"* ]]; then
        log "识别为应用相关进程，执行温和终止..."
        force_kill_port "$APP_PORT" "TERM"
    else
        log_warn "进程 '$pname' 可能不是应用进程"
        read -p "是否强制清理? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            force_kill_port "$APP_PORT" "KILL"
        else
            log "已取消"
            return 1
        fi
    fi
}

kill_app_process() {
    need_root
    log_header "终止应用进程"

    local pids=$(pgrep -f "${APP_NAME}-3.1.0.jar" || true)

    if [[ -z "$pids" ]]; then
        log_ok "未找到运行中的应用"
        return 0
    fi

    for pid in $pids; do
        local pname=$(get_process_name "$pid")
        log "终止 PID $pid ($pname)..."
        kill "$pid" 2>/dev/null || true
        sleep 1

        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
            sleep 1
        fi

        if kill -0 "$pid" 2>/dev/null; then
            log_error "无法终止 PID $pid"
        else
            log_ok "已终止 PID $pid"
        fi
    done

    rm -f "$PID_FILE"
    log_ok "应用进程已清理"
}

cleanup_all_ports() {
    need_root
    log_header "清理所有相关端口"

    local ports=(3306 6379 8888)

    for port in "${ports[@]}"; do
        if check_port "$port"; then
            log "检查端口 $port..."
            force_kill_port "$port" "TERM"
        else
            log_ok "端口 $port 空闲"
        fi
    done
}

install_dependencies() {
    log_header "安装系统依赖"

    local os=$(detect_os)

    case "$os" in
        debian)
            log "检测到 Debian/Ubuntu 系统"
            apt-get update
            apt-get install -y coreutils net-tools procps lsof iproute2 curl wget
            ;;
        rhel)
            log "检测到 RHEL/CentOS 系统"
            yum install -y coreutils net-tools procps-ng lsof iproute curl wget
            ;;
        arch)
            log "检测到 Arch Linux 系统"
            pacman -Sy --noconfirm coreutils net-tools procps-ng lsof iproute2 curl wget
            ;;
        alpine)
            log "检测到 Alpine Linux 系统"
            apk add coreutils net-tools procps lsof iproute2 curl wget
            ;;
        *)
            log_error "不支持的操作系统"
            return 1
            ;;
    esac

    log_ok "依赖安装完成"
}

check_dependencies() {
    local missing=()

    for cmd in ss netstat lsof kill pgrep curl wget; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_warn "缺少必要工具: ${missing[*]}"
        return 1
    fi

    log_ok "所有依赖已满足"
    return 0
}

show_help() {
    cat << EOF
${CYAN}StarMC 智能端口清理脚本 v3.1${NC}

${GREEN}用法:${NC}
  $0 <命令> [参数]

${GREEN}命令:${NC}
  status              查看端口占用状态
  list                列出端口使用情况
  clean               智能清理端口
  force               强制清理端口
  kill-app            终止应用进程
  kill-all            清理所有相关端口 (3306, 6379, 8888)
  install             安装系统依赖
  check               检查依赖完整性
  help                显示帮助信息

${GREEN}示例:${NC}
  $0 status           查看端口状态
  $0 clean            智能清理端口
  $0 force 8888       强制清理 8888 端口
  $0 install          安装依赖

${GREEN}环境变量:${NC}
  APP_PORT            应用端口 (默认: 8888)

EOF
}

main() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi

    case "$1" in
        status|list)
            list_port_usage
            ;;
        clean|smart)
            smart_clean
            ;;
        force)
            local port=${2:-$APP_PORT}
            force_kill_port "$port" "KILL"
            ;;
        kill-app)
            kill_app_process
            ;;
        kill-all)
            cleanup_all_ports
            ;;
        install)
            need_root
            install_dependencies
            ;;
        check)
            check_dependencies
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
