#!/bin/bash
# 后端连接超时问题诊断脚本
# 用法：bash diagnose_backend.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   后端连接诊断工具 v1.0              ║"
echo "╚════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/Users/conan/Desktop/nibi"
BACKEND_PORT=8010
BACKEND_HOST="127.0.0.1"

# ============ 诊断 1：检查进程状态 ============
echo "【诊断 1】检查后端进程..."
if pgrep -fl "uvicorn.*8010" > /dev/null 2>&1; then
    log_success "uvicorn 进程已启动（port 8010）"
elif pgrep -fl "uvicorn" > /dev/null 2>&1; then
    log_warn "找到 uvicorn 进程，但可能未在 8010 端口"
    echo "  进程列表："
    pgrep -fl "uvicorn" | sed 's/^/    /'
else
    log_error "uvicorn 进程未启动"
fi
echo ""

# ============ 诊断 2：检查端口监听 ============
echo "【诊断 2】检查端口 $BACKEND_PORT 监听状态..."
if lsof -nP -iTCP:$BACKEND_PORT -sTCP:LISTEN 2>/dev/null | grep -q "LISTEN"; then
    log_success "端口 $BACKEND_PORT 已监听"
    echo "  监听信息："
    lsof -nP -iTCP:$BACKEND_PORT -sTCP:LISTEN | sed 's/^/    /'
else
    log_error "端口 $BACKEND_PORT 无监听进程"
    log_info "可能的原因："
    echo "  1. 后端服务未启动"
    echo "  2. 后端启动失败（检查日志）"
    echo "  3. 端口被其他服务占用"
fi
echo ""

# ============ 诊断 3：健康检查 ============
echo "【诊断 3】测试健康检查端点..."
HEALTH_URL="http://$BACKEND_HOST:$BACKEND_PORT/health"
if response=$(curl -s --max-time 3 "$HEALTH_URL" 2>&1); then
    if echo "$response" | grep -q '"status"'; then
        log_success "健康检查成功"
        echo "  响应："
        echo "$response" | sed 's/^/    /'
    else
        log_error "健康检查返回异常内容"
        echo "  响应：$response"
    fi
else
    log_error "健康检查连接超时或失败"
fi
echo ""

# ============ 诊断 4：测试 /providers 端点 ============
echo "【诊断 4】测试 /providers 端点..."
PROVIDERS_URL="http://$BACKEND_HOST:$BACKEND_PORT/providers"
if response=$(curl -s --max-time 3 "$PROVIDERS_URL" 2>&1); then
    if echo "$response" | grep -qE '^\[|^\{'; then
        log_success "/providers 端点可访问"
        echo "  响应（前 500 字）："
        echo "$response" | head -c 500 | sed 's/^/    /'
        echo ""
    else
        log_error "/providers 返回异常内容"
        echo "  响应：$response"
    fi
else
    log_error "/providers 连接超时或失败"
fi
echo ""

# ============ 诊断 5：前端配置检查 ============
echo "【诊断 5】检查前端配置..."
FE_ENV="$PROJECT_DIR/frontend/.env"
if [[ -f "$FE_ENV" ]]; then
    if grep -q "VITE_BACKEND_BASE_URL=http://127.0.0.1:8010" "$FE_ENV"; then
        log_success "前端 BASE URL 正确配置"
    else
        log_warn "前端 BASE URL 配置不是 8010"
        grep "VITE_BACKEND_BASE_URL" "$FE_ENV" | sed 's/^/    /'
    fi
else
    log_warn "未找到 frontend/.env，使用默认值（http://127.0.0.1:8000）"
fi
echo ""

# ============ 诊断总结 ============
echo "【诊断总结】"
echo ""
if lsof -nP -iTCP:$BACKEND_PORT -sTCP:LISTEN 2>/dev/null | grep -q "LISTEN"; then
    log_success "后端服务运行正常"
    echo "  建议：刷新浏览器或清空 F12 缓存，重新加载页面"
else
    log_error "后端服务未运行，需要启动"
    echo "  快速启动命令："
    echo "    cd $PROJECT_DIR"
    echo "    python3.11 -m uvicorn backend.app.main:app --reload --port 8010"
    echo ""
    echo "  或使用启动脚本："
    echo "    ./start_vidmirror.command"
fi
echo ""

