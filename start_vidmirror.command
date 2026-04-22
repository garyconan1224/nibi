#!/bin/zsh
# VidMirror 一键启动脚本 (macOS)
# 用法：双击本文件或在终端执行 ./start_vidmirror.command

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
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
echo "╔═══════════════════════════════════════╗"
echo "║     VidMirror 环境启动脚本 v1.0     ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# 检查项目目录是否存在
if [[ ! -d "$PROJECT_DIR" ]]; then
    log_error "项目目录不存在: $PROJECT_DIR"
    exit 1
fi

log_info "项目路径: $PROJECT_DIR"

# 检查后端和前端目录
if [[ ! -d "$PROJECT_DIR/backend" ]]; then
    log_error "后端目录不存在"
    exit 1
fi

if [[ ! -d "$PROJECT_DIR/frontend" ]]; then
    log_error "前端目录不存在"
    exit 1
fi

log_success "项目目录结构检查完毕"

# 检查 Python 环境
if ! command -v python3.11 &> /dev/null; then
    if ! command -v python3 &> /dev/null; then
        log_error "未找到 Python 3.11 或 Python 3，请先安装 Python"
        exit 1
    fi
    PYTHON_BIN="python3"
    log_warn "使用 Python 3（而非 3.11）"
else
    PYTHON_BIN="python3.11"
    log_success "检测到 Python 3.11"
fi

# 检查 npm/pnpm
if ! command -v npm &> /dev/null; then
    log_error "未找到 npm，请先安装 Node.js"
    exit 1
fi
log_success "检测到 npm"

# 检查端口占用
check_port() {
    local port=$1
    local service=$2
    if lsof -i :$port >/dev/null 2>&1; then
        log_warn "$service 端口 $port 已被占用，将尝试重用现有进程"
        return 1
    fi
    return 0
}

BACKEND_PORT=8010
FRONTEND_PORT=5174

check_port $BACKEND_PORT "后端" || log_warn "后端可能已在运行"
check_port $FRONTEND_PORT "前端" || log_warn "前端可能已在运行"

echo ""
log_info "准备启动后端和前端服务..."
echo ""

# 使用 osascript 在两个独立的 Terminal 窗口中启动服务
osascript <<'APPLESCRIPT'
on run
    tell application "Terminal"
        activate
        
        -- 创建第一个窗口，运行后端
        do script "cd '/Users/conan/Desktop/nibi' && python3.11 -m uvicorn backend.app.main:app --reload --port 8010"
        set backendTab to (result)
        
        delay 3
        
        -- 创建第二个窗口，运行前端
        do script "cd '/Users/conan/Desktop/nibi/frontend' && npm run dev"
        set frontendTab to (result)
        
        delay 1
        
    end tell
end run
APPLESCRIPT

echo ""
log_success "服务已启动！"
echo ""
echo "╔═════════════════════════════════════════╗"
echo "║         📍 服务地址                     ║"
echo "╠═════════════════════════════════════════╣"
echo "║ 前端: http://localhost:5174            ║"
echo "║ 后端: http://localhost:8010            ║"
echo "║ 健康检查: http://localhost:8010/health ║"
echo "╚═════════════════════════════════════════╝"
echo ""
log_info "💡 提示："
echo "  • 前后端窗口已在 Terminal.app 中自动打开"
echo "  • 请在对应窗口查看实时日志输出"
echo "  • 按 Ctrl+C 可停止相应服务"
echo "  • 如需同时停止所有服务，在任意窗口按 Ctrl+C，或使用以下命令："
echo "    killall -9 uvicorn; killall -9 node"
echo ""
log_info "首次启动或依赖未安装时："
echo "  • 请确保已运行: pip install -r requirements.txt"
echo "  • 请确保已运行: cd frontend && npm install"
echo ""

# 保持脚本窗口打开，显示提示信息
sleep 2
read -p "脚本执行完毕，按 Enter 关闭此窗口..."

