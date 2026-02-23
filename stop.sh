#!/bin/bash
# 聊天室停止脚本

echo "正在停止聊天室服务器..."

# 停止所有相关进程
pkill -f "python3.*main.py" 2>/dev/null
pkill -f "uvicorn.*main:app" 2>/dev/null

sleep 1

# 检查是否停止成功
if ! pgrep -f "python3.*main.py" > /dev/null; then
    echo "✓ 服务器已停止"
else
    echo "✗ 停止失败，请手动检查进程"
fi
