# 🔧 macOS 脚本权限修复完全指南

## 问题描述

在 macOS 上双击 `.command` 脚本时，可能收到错误提示：
```
"无法执行，因为你没有正确的访问权限"
或
"需要下载的项目不能打开，因为来自未被信任的开发者"
```

这是因为：
1. 文件缺少执行权限（不可执行）
2. macOS 添加了隔离属性（Quarantine），限制从网络获取的文件执行

---

## 快速修复（推荐）

### 方法 1️⃣：使用修复脚本（最简单）

#### 步骤 1：打开终端

- 打开 Spotlight（按 ⌘ + 空格）
- 输入 `terminal`，按 Enter

#### 步骤 2：运行修复脚本

复制粘贴以下命令到终端：

```bash
bash /Users/conan/Desktop/nibi/FIX_PERMISSIONS.sh
```

或使用 Python 脚本：

```bash
python3 /Users/conan/Desktop/nibi/fix_permissions.py
```

#### 步骤 3：验证修复

脚本运行完毕后，你应该看到：
```
✅ start_vidmirror.command (权限: 755)
✅ start_vidmirror_advanced.command (权限: 755)
✅ INSTALL_DESKTOP_SHORTCUT.sh (权限: 755)
```

---

### 方法 2️⃣：手动修复（清晰易懂）

如果你偏好手动控制，按以下步骤操作：

#### 步骤 1：赋予执行权限

在终端中运行：

```bash
chmod +x /Users/conan/Desktop/nibi/start_vidmirror.command
chmod +x /Users/conan/Desktop/nibi/start_vidmirror_advanced.command
chmod +x /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh
```

#### 步骤 2：移除隔离属性

在终端中运行：

```bash
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror.command 2>/dev/null
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror_advanced.command 2>/dev/null
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh 2>/dev/null
```

#### 步骤 3：验证修复

检查权限：

```bash
ls -lh /Users/conan/Desktop/nibi/start_vidmirror*.command /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh
```

你应该看到 `rwxr-xr-x` 权限（包含 `x`）

---

### 方法 3️⃣：右键打开（应急方案）

如果上述方法不行，使用以下步骤：

1. 在 Finder 中找到脚本文件
2. **右键点击**文件（或 Ctrl+点击）
3. 选择**打开**选项
4. macOS 会显示安全警告
5. 点击**打开**按钮以手动授权
6. 系统会记住信任，之后可直接双击

---

## 单个文件修复命令速查

### 修复 start_vidmirror.command

```bash
chmod +x /Users/conan/Desktop/nibi/start_vidmirror.command
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror.command 2>/dev/null
```

### 修复 start_vidmirror_advanced.command

```bash
chmod +x /Users/conan/Desktop/nibi/start_vidmirror_advanced.command
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror_advanced.command 2>/dev/null
```

### 修复 INSTALL_DESKTOP_SHORTCUT.sh

```bash
chmod +x /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh 2>/dev/null
```

---

## 验证和诊断

### 检查文件权限

```bash
# 查看详细权限信息
ls -lh /Users/conan/Desktop/nibi/start_vidmirror.command

# 若输出显示 -rwxr-xr-x，则权限正确
# 若显示 -rw-r--r--，则需要 chmod +x
```

### 检查隔离属性

```bash
# 列出所有扩展属性
xattr -l /Users/conan/Desktop/nibi/start_vidmirror.command

# 若包含 com.apple.quarantine，需要移除
# 若为空或无 com.apple.quarantine，则已清除
```

### 测试可执行性

```bash
# 检查文件是否可执行
test -x /Users/conan/Desktop/nibi/start_vidmirror.command && echo "✅ 可执行" || echo "❌ 不可执行"
```

---

## 常见问题排查

### Q1: chmod 命令找不到

**答：** 使用完整路径：

```bash
/bin/chmod +x /Users/conan/Desktop/nibi/start_vidmirror.command
```

### Q2: xattr 命令出错

**答：** 错误可以忽略（如果文件不含隔离属性）。或使用：

```bash
xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror.command
# 忽略任何错误
```

### Q3: 仍然双击无法打开

**答：** 使用右键菜单打开（方法 3）

### Q4: 想恢复隔离属性

**答：** 重新下载文件或使用：

```bash
xattr -w com.apple.quarantine "0081;..." /Users/conan/Desktop/nibi/start_vidmirror.command
```

---

## 🎯 修复完成后

完成以上修复后，你可以：

✅ 直接双击脚本启动 VidMirror  
✅ 在终端中运行 `./start_vidmirror.command`  
✅ 无需再经过右键打开的步骤  

---

## 💡 相关文档

- **QUICKSTART.md** - 快速开始指南
- **START_GUIDE.md** - 完整使用手册
- **FIX_PERMISSIONS.sh** - 自动修复脚本
- **fix_permissions.py** - Python 修复脚本

---

**修复日期：** 2026-04-22  
**目标脚本：** VidMirror macOS 启动脚本  
**修复方法：** chmod + xattr  

如有其他问题，请查看完整文档或在终端中运行修复脚本。✨

