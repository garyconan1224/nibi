#!/bin/bash
# 双击启动 VidMirror（一键重启前后端）。
# Finder 会用「终端 Terminal.app」打开这个文件并执行。

cd "$(dirname "$0")" || exit 1
./dev.sh

# 自动打开前端页面
VITE_PORT=$(grep -E '^VITE_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'")
VITE_PORT=${VITE_PORT:-5173}
sleep 1
open "http://localhost:$VITE_PORT/"

echo
echo "════════════════════════════════════════════════"
echo "  浏览器已自动打开。需要停止时跑：./stop.sh"
echo "  这个终端窗口可以直接关闭，服务在后台继续跑。"
echo "════════════════════════════════════════════════"
