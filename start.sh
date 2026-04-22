#!/bin/bash

PROJECT="/Users/conan/Desktop/nibi"
echo "🚀 启动 VidMirror..."

# 启动后端
cd "$PROJECT"
python3.11 -m uvicorn backend.app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ 后端已启动 (port 8000, PID: $BACKEND_PID)"

# 等后端起来再启前端
sleep 2

# 启动前端
cd "$PROJECT/frontend"
VITE_BACKEND_BASE_URL=http://127.0.0.1:8000 npm run dev &
FRONTEND_PID=$!
echo "✅ 前端已启动 (PID: $FRONTEND_PID)"

echo ""
echo "前端地址: http://localhost:5174"
echo "后端地址: http://localhost:8000"
echo ""
echo "按 Ctrl+C 关闭所有服务 ↓"

# 按 Ctrl+C 时同时关掉两个进程
trap "echo ''; echo '正在关闭...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 已关闭'; exit" INT
wait
