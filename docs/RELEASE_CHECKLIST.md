# 发布前检查清单（密钥与隐私）

在将仓库公开或分享给他人之前，请完成以下步骤。

## 1. 扫描仓库中的密钥形态

在项目根目录执行：

```bash
rg 'sk-[a-zA-Z0-9]{20,}' --glob '!*.plan.md'
rg 'SILICONFLOW_API_KEY\s*=' --glob '*.py'
rg 'ANTHROPIC_API_KEY\s*=' --glob '*.py'
```

确认**没有**真实 `sk-` 字符串或带真值的 Key 赋值（仅允许 `local_settings.example.py`、`.env.example` 中的占位符）。

## 2. 确认未跟踪敏感文件

- 根目录存在 `local_settings.py` 时**不要提交**（已在 `.gitignore` 中）。
- 不要提交 `.env`（已在 `.gitignore` 中）。
- 不要提交 `.local/settings.json`（统一设置页自动保存的本地 API 配置）。
- 各子目录历史中的 `local_settings.py` 若曾含真 Key，应删除文件并**轮换**对应平台密钥。

## 3. 若密钥曾进入 Git 历史

- 在对应平台（硅基流动、Anthropic 等）**作废并重新生成** API Key。
- 若仓库已推送且历史中含密钥，考虑使用 `git filter-repo` 等工具从历史中清除，并通知协作者重新克隆；无法清理时一律视为密钥已泄露。

## 4. 环境变量与文档

- 发布版仅保留 [`.env.example`](/.env.example) 中的**空占位**说明。
- CI/CD 使用平台提供的 Secrets，勿在 YAML 中硬编码 Key。

## 5. 可选：发布前本地再测

复制 `.env.example` 为 `.env`，仅在本地填入测试 Key，运行 `streamlit run app.py` 验证三页流程；**不要将 `.env` 加入版本控制**。

## 6. 发布前清理本地设置页数据

- 若使用过“设置页”保存 API，请删除 `.local/settings.json` 或在设置页点击“清空本地设置”。
- 清理后重新执行第 1 节扫描命令，确认仓库与工作区中无真实密钥残留。
