#!/bin/bash
# VidMirror — AI 视频创作工作台 启动脚本
# 双击此文件即可在 macOS 上启动

cd "$(dirname "$0")"

echo "=================================="
echo "  VidMirror — AI 视频创作工作台"
echo "=================================="

# macOS 双击 .command 时 PATH 较小，主动补齐常见 Python 与 Homebrew 安装位置
export PATH="/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:/Library/Frameworks/Python.framework/Versions/3.11/bin:/Library/Frameworks/Python.framework/Versions/3.10/bin:$PATH"

# 选择一个 >=3.10 的 Python 解释器，优先更高版本
select_python() {
    local candidates=(
        "$VPS_BACKEND_PYTHON"
        "python3.12"
        "python3.11"
        "python3.10"
        "/opt/homebrew/bin/python3.12"
        "/opt/homebrew/bin/python3.11"
        "/opt/homebrew/bin/python3.10"
        "/usr/local/bin/python3.12"
        "/usr/local/bin/python3.11"
        "/usr/local/bin/python3.10"
        "python3"
    )
    local best="" best_minor=-1
    local cand exe ver major minor
    for cand in "${candidates[@]}"; do
        [ -z "$cand" ] && continue
        if [[ "$cand" == */* ]]; then
            exe="$cand"
        else
            exe="$(command -v "$cand" 2>/dev/null)"
            [ -z "$exe" ] && continue
        fi
        [ -x "$exe" ] || continue
        ver="$("$exe" -c 'import sys;print(f"{sys.version_info[0]} {sys.version_info[1]}")' 2>/dev/null)" || continue
        major="${ver%% *}"
        minor="${ver##* }"
        [ "$major" = "3" ] || continue
        [ "$minor" -lt 10 ] && continue
        if [ "$minor" -gt "$best_minor" ]; then
            best="$exe"
            best_minor="$minor"
        fi
    done
    echo "$best"
}

PYBIN="$(select_python)"
if [ -z "$PYBIN" ]; then
    echo "错误: 未找到 Python 3.10+。请先安装："
    echo "  brew install python@3.11"
    echo "或从 https://www.python.org/downloads/ 下载安装 3.10+。"
    read -p "按回车退出..."
    exit 1
fi
echo "使用 Python 解释器: $PYBIN ($("$PYBIN" --version 2>&1))"

# 让后端启动器（backend_launcher）使用同一解释器，避免再次挑选时走到 3.8
export VPS_BACKEND_PYTHON="$PYBIN"

# 检查并安装依赖（streamlit 前端 + uvicorn/fastapi 后端）
if ! "$PYBIN" -c "import streamlit, uvicorn, fastapi, pydantic" 2>/dev/null; then
    echo "正在为 $PYBIN 安装依赖（首次运行可能需要几分钟）..."
    if ! "$PYBIN" -m pip install --upgrade pip; then
        echo "警告: 升级 pip 失败，继续尝试安装依赖..."
    fi
    if ! "$PYBIN" -m pip install -r requirements.txt; then
        echo ""
        echo "依赖安装失败。请手动执行以下命令后重试："
        echo "  $PYBIN -m pip install -r requirements.txt"
        read -p "按回车退出..."
        exit 1
    fi
fi

# 检查 ffmpeg（非必须，但视频转码需要）
if ! command -v ffmpeg &>/dev/null; then
    echo "警告: 未检测到 ffmpeg，视频转码功能将不可用。"
    echo "安装方法: brew install ffmpeg"
fi

# 检查 API Key 配置
if [ ! -f "local_settings.py" ] && [ -z "$SILICONFLOW_API_KEY" ]; then
    echo ""
    echo "提示: 未检测到 API Key 配置。"
    echo "请创建 local_settings.py 并填写 SILICONFLOW_API_KEY，"
    echo "或在启动后的页面中直接填写。"
    echo "参考示例: local_settings.example.py"
fi

echo ""
echo "正在启动... 浏览器将自动打开"
echo "地址: http://localhost:8501"
echo "按 Ctrl+C 退出"
echo ""

# 预启动后端（失败则阻断前端）
echo "正在检查并启动后端任务中心..."
"$PYBIN" - <<'PY'
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
sys.path.insert(0, str(root))

try:
    from shared.backend_launcher import start_backend_once
except Exception as err:  # noqa: BLE001
    print(f"后端启动器加载失败: {err}")
    raise SystemExit(1)

result = start_backend_once()
print(result.message)
if not result.ok:
    raise SystemExit(1)
PY
if [ $? -ne 0 ]; then
    echo ""
    echo "后端启动失败，已阻断前端启动。"
    echo "请按提示修复后重试。"
    read -p "按回车退出..."
    exit 1
fi

# 启动 Streamlit（与后端使用同一解释器）
"$PYBIN" -m streamlit run app.py --server.port 8501 --browser.gatherUsageStats false
