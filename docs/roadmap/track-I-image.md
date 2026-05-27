# Track I：图片（Image）

> 来源：原 `docs/ROADMAP.md` §7（拆分于 2026-05-26）。
> 流程图依据：`docs/flows/image.md`（源图：`图片.png`）——基本信息 + 任务勾选 + 联想

---

## I1 EXIF 提取 + 基本信息卡

**索引**：`docs/flows/image.md` 中"基本信息（分辨率 / 拍摄设备 / EXIF）"
**模型**：⭐ deepseek v4-pro（前端展示 + 后端 PIL 一行）

**分支**：`feat/i1-image-exif`
**子任务**：
- I1.1 后端 image handler 输出 EXIF 字典
- I1.2 ImageResultPage 加基本信息卡（设计稿 image_detail.jsx 已有 layout）

---

## I2 批量任务执行

**索引**：`docs/flows/image.md` 多图勾选区
**模型**：Sonnet
**分支**：`feat/i2-image-batch`
**子任务**：
- I2.1 ImageResultPage 多图勾选 + 批量打标 / 联想 / 重写提示词
- I2.2 批量结果对比导出

---

## I3 图片风格 DNA 报告（与 R3 重叠）

**索引**：N9 现有 4 联想方向 + `docs/flows/remix.md`
**模型**：Sonnet
**分支**：`feat/i3-image-style-dna`
**子任务**：
- I3.1 单图 → 风格特征向量（颜色 / 构图 / 主体 / 氛围）
- I3.2 多图聚类 → 风格簇报告
- I3.3 输入"风格目标" → 找相似图
