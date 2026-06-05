#!/bin/bash
# 快速重启前后端：先杀旧端口，再起新进程。
# 跳过依赖检查（假定已跑过 ./start.sh 装好环境）。
# 用法：./dev.sh        启动
#       ./stop.sh       停止
#       tail -f .local/backend.log .local/frontend.log   看日志

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p .local

# ── 读取端口（.env 优先，否则默认） ──────────────────────────────
BACKEND_PORT=$(grep -E '^BACKEND_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'")
VITE_PORT=$(grep -E '^VITE_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'")
BACKEND_PORT=${BACKEND_PORT:-8000}
VITE_PORT=${VITE_PORT:-5173}

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# ── 清端口 ────────────────────────────────────────────────────
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        printf "${YELLOW}⚠  端口 %s 被占用，杀掉 PID: %s${NC}\n" "$port" "$(echo $pids | tr '\n' ' ')"
        kill -9 $pids 2>/dev/null || true
        sleep 0.3
    fi
}
kill_port "$BACKEND_PORT"
kill_port "$VITE_PORT"

# ── 起后端 ────────────────────────────────────────────────────
if [[ ! -x .venv/bin/uvicorn ]]; then
    printf "${YELLOW}⚠  .venv 不存在，请先跑一次 ./start.sh${NC}\n"
    exit 1
fi
printf "${BLUE}▶ 启动后端 :%s${NC}\n" "$BACKEND_PORT"
nohup .venv/bin/uvicorn backend.app.main:app --reload --port "$BACKEND_PORT" \
    > .local/backend.log 2>&1 &
echo $! > .local/backend.pid

# ── 起前端 ────────────────────────────────────────────────────
if [[ ! -d frontend/node_modules ]]; then
    printf "${YELLOW}⚠  frontend/node_modules 不存在，请先跑一次 ./start.sh${NC}\n"
    exit 1
fi
printf "${BLUE}▶ 启动前端 :%s${NC}\n" "$VITE_PORT"
export VITE_BACKEND_BASE_URL="http://127.0.0.1:$BACKEND_PORT"
(
    cd frontend
    nohup pnpm dev --host --port "$VITE_PORT" \
        > ../.local/frontend.log 2>&1 &
    echo $! > ../.local/frontend.pid
)

# ── 健康探测 ──────────────────────────────────────────────────
printf "${BLUE}▶ 等待后端就绪…${NC}\n"
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "" "http://localhost:$BACKEND_PORT/health" 2>/dev/null; then
        if curl -s "http://localhost:$BACKEND_PORT/health" 2>/dev/null | grep -q healthy; then
            printf "${GREEN}✔  后端已就绪${NC}\n"
            break
        fi
    fi
    sleep 0.3
done

printf "${BLUE}▶ 等待前端就绪…${NC}\n"
for i in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$VITE_PORT/" 2>/dev/null; then
        printf "${GREEN}✔  前端已就绪${NC}\n"
        break
    fi
    sleep 0.3
done

cat <<EOF

${GREEN}══════════════════════════════════════════════
  ✔ VidMirror 已启动
══════════════════════════════════════════════${NC}
  前端:   http://localhost:$VITE_PORT
  后端:   http://localhost:$BACKEND_PORT
  日志:   tail -f .local/backend.log .local/frontend.log
  停止:   ./stop.sh
EOF
