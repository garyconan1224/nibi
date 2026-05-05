#!/bin/bash
# ══════════════════════════════════════════════════════════════════
#  VidMirror 双击启动入口
#  ─ 放在项目根目录，macOS 双击即可在 Terminal 中运行 ─
#  ─ 此文件与 start.sh 同目录，路径自动检测，无需修改 ─
# ══════════════════════════════════════════════════════════════════

# 获取此文件所在目录（可移植，支持任意路径）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
START_SCRIPT="$SCRIPT_DIR/start.sh"

if [[ ! -f "$START_SCRIPT" ]]; then
    echo "❌ 未找到启动脚本: $START_SCRIPT"
    echo "   请确保此文件与 start.sh 在同一目录下。"
    read -r -p "按回车键退出..."
    exit 1
fi

# 确保 start.sh 有执行权限
chmod +x "$START_SCRIPT"

# 切换到项目目录并执行
cd "$SCRIPT_DIR"
/bin/bash "$START_SCRIPT"
EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
    echo ""
    echo "⚠  启动器退出（代码: $EXIT_CODE）"
    echo "   查看日志: $SCRIPT_DIR/.local/backend.log"
    read -r -p "按回车键关闭..."
fi
