#!/bin/bash

PROJECT="/Users/conan/Desktop/nibi"
echo "🚀 启动 VidMirror..."

# 加载根目录 .env
if [ -f "$PROJECT/.env" ]; then
    set -a
    . "$PROJECT/.env"
    set +a
    echo "ℹ️  已加载 $PROJECT/.env"
fi
VITE_PORT="${VITE_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# 端口占用自动清理
for p in "$BACKEND_PORT" "$VITE_PORT"; do
    pids=$(lsof -iTCP:"$p" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1 {print $2}' | sort -u)
    if [ -n "$pids" ]; then
        echo "⚠️  检测到端口 $p 被占用，正在自动清理进程..."
        for pid in $pids; do
            echo "   → 强制杀死 PID $pid"
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 0.5
        echo "   ✅ 清理完成"
    fi
done

# Python 选择
if command -v python3.11 &> /dev/null; then
    PYTHON_BIN="python3.11"
else
    PYTHON_BIN="python3"
fi
echo "ℹ️  使用 Python 解释器: $PYTHON_BIN"

# 后端依赖自检
missing=()
for mod in psutil fastapi uvicorn pydantic dotenv httpx tenacity requests; do
    if ! "$PYTHON_BIN" -c "import ${mod}" >/dev/null 2>&1; then
        missing+=("$mod")
    fi
done
if [ ${#missing[@]} -gt 0 ]; then
    echo "⚠️  检测到后端依赖缺失: ${missing[*]}"
    "$PYTHON_BIN" -m pip install -r "$PROJECT/requirements.txt" || exit 1
    echo "✅ 后端依赖安装完成"
else
    echo "✅ 后端关键依赖齐全"
fi

# 前端依赖自检
if [ ! -d "$PROJECT/frontend/node_modules" ]; then
    echo "⚠️  frontend/node_modules 不存在，自动执行 npm install ..."
    (cd "$PROJECT/frontend" && npm install) || exit 1
    echo "✅ 前端依赖安装完成"
fi

# 启动后端
cd "$PROJECT"
"$PYTHON_BIN" -m uvicorn backend.app.main:app --reload --port "$BACKEND_PORT" &
BACKEND_PID=$!
echo "✅ 后端已启动 (port $BACKEND_PORT, PID: $BACKEND_PID)"

sleep 2

# 启动前端
cd "$PROJECT/frontend"
VITE_BACKEND_BASE_URL="http://127.0.0.1:$BACKEND_PORT" npm run dev &
FRONTEND_PID=$!
echo "✅ 前端已启动 (PID: $FRONTEND_PID)"

echo ""
echo "前端地址: http://localhost:$VITE_PORT"
echo "后端地址: http://localhost:$BACKEND_PORT"
echo ""
echo "按 Ctrl+C 关闭所有服务 ↓"

trap "echo ''; echo '正在关闭...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 已关闭'; exit" INT
wait
