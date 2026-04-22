#!/bin/bash

PROJECT="/Users/conan/Desktop/nibi"
echo "🚀 启动 VidMirror..."

# Python 解释器选择（优先 3.11；否则回退到 python3）
if command -v python3.11 &> /dev/null; then
    PYTHON_BIN="python3.11"
else
    PYTHON_BIN="python3"
fi
echo "ℹ️  使用 Python 解释器: $PYTHON_BIN"

# 后端依赖自检（使用 $PYTHON_BIN -m pip 绑定解释器，避免多版本 Python 导致依赖装错位置）
missing=()
for mod in psutil fastapi uvicorn pydantic dotenv httpx tenacity requests; do
    if ! "$PYTHON_BIN" -c "import ${mod}" >/dev/null 2>&1; then
        missing+=("$mod")
    fi
done
if [ ${#missing[@]} -gt 0 ]; then
    echo "⚠️  检测到后端依赖缺失: ${missing[*]}，自动安装 requirements.txt ..."
    "$PYTHON_BIN" -m pip install -r "$PROJECT/requirements.txt" || {
        echo "❌ 后端依赖安装失败，请手动执行：$PYTHON_BIN -m pip install -r requirements.txt"
        exit 1
    }
    echo "✅ 后端依赖安装完成"
else
    echo "✅ 后端关键依赖齐全"
fi

# 前端依赖自检
if [ ! -d "$PROJECT/frontend/node_modules" ]; then
    echo "⚠️  frontend/node_modules 不存在，自动执行 npm install ..."
    (cd "$PROJECT/frontend" && npm install) || { echo "❌ 前端依赖安装失败"; exit 1; }
    echo "✅ 前端依赖安装完成"
fi

# 启动后端
cd "$PROJECT"
"$PYTHON_BIN" -m uvicorn backend.app.main:app --reload --port 8000 &
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
