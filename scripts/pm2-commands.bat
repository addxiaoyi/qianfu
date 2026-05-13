@echo off
REM PM2 服务管理快捷命令 (Windows)
REM 使用方法:
REM   scripts\pm2-commands.bat start    启动单体
REM   scripts\pm2-commands.bat ms       启动微服务集群
REM   scripts\pm2-commands.bat status   查看状态
REM   scripts\pm2-commands.bat logs     查看日志
REM   scripts\pm2-commands.bat stop     停止所有

setlocal enabledelayedexpansion

set COMMAND=%1

if "%COMMAND%"=="" (
    echo Usage: pm2-commands.bat {start^|ms^|status^|logs^|restart^|stop^|info}
    exit /b 1
)

cd /d "%~dp0\.."

echo.

if "%COMMAND%"=="start" (
    echo Starting monolith with PM2...
    npx pm2 start ecosystem.microservices.config.js --only qianfu-monolith
) else if "%COMMAND%"=="ms" (
    echo Starting microservices cluster...
    npx pm2 start ecosystem.microservices.config.js
) else if "%COMMAND%"=="status" (
    npx pm2 list
) else if "%COMMAND%"=="logs" (
    npx pm2 logs --lines 50
) else if "%COMMAND%"=="logs-err" (
    npx pm2 logs --err --lines 50
) else if "%COMMAND%"=="restart" (
    echo Restarting all services...
    npx pm2 restart all
) else if "%COMMAND%"=="stop" (
    echo Stopping all services...
    npx pm2 delete all
) else if "%COMMAND%"=="mon" (
    npx pm2 monit
) else if "%COMMAND%"=="info" (
    echo === PM2 Info ===
    npx pm2 --version
    echo.
    echo === Service Status ===
    npx pm2 list
) else (
    echo Unknown command: %COMMAND%
    echo.
    echo Usage: pm2-commands.bat {start^|ms^|status^|logs^|restart^|stop^|mon^|info}
    echo.
    echo Commands:
    echo   start   - 启动单体应用
    echo   ms      - 启动微服务集群
    echo   status  - 查看服务状态
    echo   logs    - 查看最近日志
    echo   restart - 重启所有服务
    echo   stop    - 停止所有服务
    echo   mon     - 启动监控面板
    echo   info    - 显示PM2信息和状态
    exit /b 1
)

echo.
