#!/bin/bash
# macOS 桌面快捷方式安装脚本
# 用法：bash INSTALL_DESKTOP_SHORTCUT.sh

PROJECT_DIR="/Users/conan/Desktop/nibi"
SCRIPT_FILE="$PROJECT_DIR/start_vidmirror.command"
DESKTOP_DIR="$HOME/Desktop"
SHORTCUT_NAME="VidMirror 启动"

# 检查脚本是否存在
if [[ ! -f "$SCRIPT_FILE" ]]; then
    echo "❌ 错误：找不到启动脚本 $SCRIPT_FILE"
    exit 1
fi

# 检查脚本是否可执行
if [[ ! -x "$SCRIPT_FILE" ]]; then
    echo "⚠️  脚本缺少执行权限，正在修复..."
    chmod +x "$SCRIPT_FILE"
fi

# 创建方案 1：使用 cp 复制（简单方式）
echo "📋 可用的安装方式："
echo ""
echo "方式 1: 将脚本复制到桌面（推荐，简单快速）"
echo "方式 2: 创建符号链接（高级，节省空间）"
echo "方式 3: 创建 macOS 快捷方式（最优雅）"
echo ""
read -p "请选择方式 (1/2/3) [默认: 1]: " choice
choice=${choice:-1}

case $choice in
    1)
        echo ""
        echo "正在复制启动脚本到桌面..."
        cp "$SCRIPT_FILE" "$DESKTOP_DIR/$SHORTCUT_NAME.command"
        chmod +x "$DESKTOP_DIR/$SHORTCUT_NAME.command"
        echo "✅ 成功！脚本已复制到桌面: $DESKTOP_DIR/$SHORTCUT_NAME.command"
        echo "   现在可以直接双击桌面上的文件启动 VidMirror"
        ;;
    2)
        echo ""
        echo "正在创建符号链接到桌面..."
        ln -sf "$SCRIPT_FILE" "$DESKTOP_DIR/$SHORTCUT_NAME.command"
        echo "✅ 成功！已创建符号链接: $DESKTOP_DIR/$SHORTCUT_NAME.command"
        echo "   符号链接指向: $SCRIPT_FILE"
        ;;
    3)
        echo ""
        echo "正在创建 macOS 快捷方式..."
        osascript <<APPLESCRIPT
tell application "Finder"
    set projFolder to POSIX file "$PROJECT_DIR"
    set scriptFile to "$SCRIPT_FILE"
    
    -- 打开项目目录
    open projFolder
    
    display notification "请将启动脚本拖到桌面以创建快捷方式" with title "VidMirror"
end tell
APPLESCRIPT
        echo "✅ 项目目录已打开，请手动将脚本拖到桌面创建快捷方式"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "📍 下一步："
echo "   1. 打开 Finder 查看结果"
echo "   2. 双击快捷方式启动 VidMirror"
echo "   3. 查看 START_GUIDE.md 了解更多用法"

