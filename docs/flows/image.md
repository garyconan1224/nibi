# Image Flow Text Mirror

source_image: `docs/conversation-inputs/2026-05-18-spec-merge/图片.png`
image_size: `1498x2242`
source_sha256: `3fee08f57953637d8ced1bd5ed05a23a740fbabe942913761d521c9b3bc415c9`
last_text_sync: `2026-05-23`
read_policy: 先读本文件；需要核对缩略图、EXIF 视觉排布或原图细节时再读源 PNG。

## 摘要

图片分支支持网络图片、本地图片和批量上传，先读取基础信息和 EXIF，再按用户勾选执行内容识别、OCR、图片提示词生成、联想总结、多图对比、情绪/风格判断。结果页应同时展示图片缩略图、识别描述、OCR、prompt、EXIF 与可复制/收藏动作。

## Mermaid

```mermaid
flowchart TD
  IN["输入<br/>网络图片 / 本地图片 / 批量图片"] --> READ["下载 / 读取图片"]
  READ --> EXPORT["原图可直接导出"]
  READ --> INFO["基础信息<br/>分辨率 / 格式 / 大小 / EXIF"]
  INFO --> PRE["前置配置<br/>背景信息 / 任务勾选"]

  PRE --> DESC["图片内容识别 / 描述"]
  PRE --> OCR["OCR 文字提取"]
  PRE --> PROMPT["生成图片提示词"]
  PRE --> ASSOC["内容联想 / 总结"]
  PRE --> CMP{"多图?"}
  PRE --> STYLE["情绪 / 风格判断"]

  DESC --> VM["视觉模型<br/>GPT-4V / Claude / Gemini 等"]
  VM --> DOUT["输出图片描述<br/>主体 / 场景 / 色调"]
  OCR --> OCR2["版面清洗"]
  OCR2 --> OOUT["输出提取文本"]
  PROMPT --> PSTYLE["选择 prompt 风格<br/>MJ / SD / JSON"]
  PSTYLE --> POUT["输出图片提示词"]
  ASSOC --> ADIR["联想方向<br/>用途 / 设计 / 竞品 / 情绪"]
  ADIR --> AOUT["输出联想总结"]
  CMP -->|是| COUT["多图对比<br/>差异 / 共性 / 风格一致性"]

  DOUT --> RESULT["结果展示 + 导出"]
  OOUT --> RESULT
  POUT --> RESULT
  AOUT --> RESULT
  COUT --> RESULT
  STYLE --> RESULT
```

## 任务勾选

| 勾选项 | 输出 |
|---|---|
| 图片内容识别 / 描述 | 主体、场景、色调、构图、可能用途。 |
| OCR 文字提取 | 清洗后的文字和版面信息。 |
| 生成图片提示词 | MJ / SD / JSON 等风格 prompt。 |
| 内容联想 / 总结 | 按用途、受众、设计意图、竞品或情绪方向展开。 |
| 多图对比 | 多图共性、差异、风格一致性、表格或报告。 |
| 情绪 / 风格判断 | 风格标签、情绪标签、视觉 DNA。 |

## 结果与导出

| 区域 | 内容 |
|---|---|
| 缩略图/原图 | 左图右信息，点击可看详情。 |
| EXIF | 分辨率、格式、时间、设备、地点等；单独展示。 |
| 分析结果 | 描述、OCR、prompt、联想、对比。 |
| 动作 | 一键复制、加入收藏、导出 `.md` / `.txt` / `.json`。 |

## 代码锚点

| 层 | 位置 |
|---|---|
| 后端任务 | `backend/app/services/pipeline_tasks.py::handle_image_task` |
| 图片分析 | `shared/image_analyzer.py`、`shared/image_prompts.py` |
| 前端结果 | `frontend/src/pages/result/ImageResultPage.tsx` |
