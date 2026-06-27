#!/bin/bash
# 双击停止 Nibi。
cd "$(dirname "$0")" || exit 1
./stop.sh
echo
echo "完成。可以关闭窗口。"
sleep 1
