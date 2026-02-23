#!/bin/bash
# 聊天室启动脚本

cd "$(dirname "$0")/backend"

echo "正在启动聊天室服务器..."

# 停止已运行的服务器（如果有）
pkill -f "python3 main.py" 2>/dev/null

# 启动服务器
nohup python3 main.py > server.log 2>&1 &

sleep 2

# 检查服务器是否启动成功
if curl -s http://localhost:8000 > /dev/null; then
    echo "✓ 服务器启动成功！"
    echo ""
    echo "访问地址:"
    echo "  - API 文档: http://localhost:8000/docs"
    echo "  - 前端页面: 直接打开 frontend/index.html 文件"
    echo ""
    echo "查看日志: tail -f backend/server.log"
    echo "停止服务器: pkill -f 'python3 main.py'"
else
    echo "✗ 服务器启动失败，请查看日志："
    cat server.log
fi
