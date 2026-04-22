#!/bin/zsh
# VidMirror 高级启动脚本 (macOS)
# 支持 Terminal.app 和 iTerm2，自动检测并选择优先终端应用

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo ""
echo "╔═════════════════════════════════════════╗"
echo "║  VidMirror 高级启动脚本 v1.1 (Advanced) ║"
echo "╚═════════════════════════════════════════╝"
echo ""

# 检查项目和环境
[[ ! -d "$PROJECT_DIR" ]] && { log_error "项目目录不存在"; exit 1; }
[[ ! -d "$PROJECT_DIR/backend" ]] && { log_error "后端目录不存在"; exit 1; }
[[ ! -d "$PROJECT_DIR/frontend" ]] && { log_error "前端目录不存在"; exit 1; }

log_info "项目路径: $PROJECT_DIR"
log_success "项目结构验证完毕"

# Python 检测
if ! command -v python3.11 &> /dev/null; then
    if ! command -v python3 &> /dev/null; then
        log_error "未找到 Python 3.11 或 Python 3"
        exit 1
    fi
    PYTHON_BIN="python3"
else
    PYTHON_BIN="python3.11"
fi
log_success "检测到 $PYTHON_BIN"

# npm 检测
command -v npm &> /dev/null || { log_error "未找到 npm"; exit 1; }
log_success "检测到 npm"

# 检测终端应用
TERMINAL_APP="Terminal"
if command -v open &> /dev/null && open -Ra iTerm &> /dev/null; then
    log_info "检测到 iTerm2，优先使用 iTerm2"
    TERMINAL_APP="iTerm"
fi

echo ""
log_info "准备启动后端和前端服务..."
echo ""

# 使用 osascript 启动（支持 Terminal 和 iTerm）
if [[ "$TERMINAL_APP" == "iTerm" ]]; then
    osascript <<'APPLESCRIPT'
on run
    tell application "iTerm"
        activate
        create window with default profile
        tell current window
            -- 后端窗口
            create tab with default profile
            tell current session
                write text "cd '/Users/conan/Desktop/nibi' && python3.11 -m uvicorn backend.app.main:app --reload --port 8000"
            end tell

            delay 3

            -- 前端窗口
            create tab with default profile
            tell current session
                write text "cd '/Users/conan/Desktop/nibi/frontend' && VITE_BACKEND_BASE_URL=http://127.0.0.1:8000 npm run dev"
            end tell
        end tell
    end tell
end run
APPLESCRIPT
else
    osascript <<'APPLESCRIPT'
on run
    tell application "Terminal"
        activate
        do script "cd '/Users/conan/Desktop/nibi' && python3.11 -m uvicorn backend.app.main:app --reload --port 8000"
        delay 3
        do script "cd '/Users/conan/Desktop/nibi/frontend' && VITE_BACKEND_BASE_URL=http://127.0.0.1:8000 npm run dev"
    end tell
end run
APPLESCRIPT
fi

echo ""
log_success "服务已启动！"
echo ""
echo "╔═════════════════════════════════════════╗"
echo "║         📍 服务地址                     ║"
echo "╠═════════════════════════════════════════╣"
echo "║ 前端: http://localhost:5174            ║"
echo "║ 后端: http://localhost:8000            ║"
echo "╚═════════════════════════════════════════╝"
echo ""
log_info "💡 更多信息请查看 START_GUIDE.md"
sleep 2

