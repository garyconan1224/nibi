# 启用指南（本地）

本文用于快速启用 `VidMirror` 的任务驱动模式（下载 / 分析 / 自动分镜）。

## 0. 前置条件

- Python 3.10+（建议）
- 已在项目根目录
- 本机可用 `ffmpeg`（视频相关流程建议安装）

## 1. 安装依赖

```bash
pip install -r requirements.txt
```

## 2. 准备环境变量（可选但推荐）

```bash
cp .env.example .env
```

按需编辑 `.env`：

- `VIDMIRROR_BACKEND_URL` 或 `BACKEND_URL`（默认 `http://127.0.0.1:8010`）；自 v0.3 起仅支持 `VIDMIRROR_BACKEND_URL`
- 各 Provider 的 API Key（建议在设置页补齐）
- ASR 相关（如 `GROQ_API_KEY`，仅在 Groq 回退时需要）

## 3. 启动后端任务中心（终端 1）

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

健康检查：

- 打开 `http://127.0.0.1:8010/health`
- 返回 `{"status":"ok"}` 即正常

## 4. 启动前端（终端 2）

```bash
streamlit run app.py
```

## 4.1 一键启动（推荐给本机双击使用）

双击根目录的 `启动工作台.command` 时，脚本会先自动检查并启动后端，再启动 Streamlit：

- 后端启动成功：继续打开前端页面
- 后端启动失败：阻断前端启动，并在终端输出可执行修复命令

## 5. 在设置页完成 Provider 配置

进入 `0_settings` 页面：

- 新增或编辑 Provider Profile
- 至少保证一个可用的 `chat` Provider（创作页需要）
- 分析流程通常需要 OpenAI 兼容 API Key
- 保存设置后会写入本地 `.local/settings.json`

## 6. 功能启用检查（最短路径）

1. 在下载页提交一个下载任务
2. 在分析页提交一个分析任务
3. 在创作页点击自动生成分镜（后端任务）

如果状态在页面可见进度变化，说明任务中心链路已启用。

## 7. 任务日志流式接口（调试用）

- SSE: `GET /pipeline/tasks/{task_id}/events`
- WebSocket: `WS /pipeline/tasks/{task_id}/ws`

## 8. 常见问题

### 后端不可达

- 确认终端 1 的 uvicorn 正在运行
- 确认端口与 `VIDMIRROR_BACKEND_URL` / `BACKEND_URL` 一致
- 你也可以在下载页/分析页/创作页点击 `手动一键启动后端` 按钮自动拉起服务

### preflight 报 provider 缺少 api_key

- 进入设置页为启用的 Provider 填写 API Key
- 再执行：

```bash
python3 scripts/preflight_check.py
```

### 下载或分析无进度

- 在页面查看任务状态和日志
- 必要时直接访问 SSE 接口查看实时输出

