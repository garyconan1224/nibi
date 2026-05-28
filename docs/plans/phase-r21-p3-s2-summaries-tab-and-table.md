---
phase: R21.P3.S2
title: 结果页「总结」tab + item_summaries 表 + 多版本 CRUD
status: pending
owner: 待定
estimated_hours: 8-12
depends_on:
  - r21-p3-s1（添加素材重构合 main 之后）
user_source: 2026-05-28 用户第三轮反馈
---

## 目标（一句话）

把「总结模板 + 总结用背景」从添加素材页彻底移到结果页，支持同一素材生成多模板、同模板多版本，全部并存可对比可删除。

## 关键设计点（不变项，S1 阶段已锁定）

1. **数据模型**：新增 `item_summaries` 表
   ```
   id (str pk) | item_id (fk) | template (enum) | version (int, 同 template 自增)
   | background_for_summary (text) | content_md (text) | created_at (ts)
   ```
2. **UI 布局**：结果页顶部 tab —— `[原始产出] [总结 (N)]`；总结 tab 左侧列表（按模板分组，同模板嵌套 v1/v2/v3），右侧主显示区
3. **新建总结面板**：选模板 + 填总结用背景 + 「生成」按钮 → 调 LLM → 写入 `item_summaries`
4. **老数据迁移**：alembic migration 把 `item.summary` 非空的迁成 `item_summaries.v1`，保留 `item.summary` 字段做兼容只读
5. **API**：
   - `GET /api/items/{id}/summaries` 列表
   - `POST /api/items/{id}/summaries` body: `{ template, background_for_summary }` → 异步触发生成
   - `DELETE /api/items/{id}/summaries/{summary_id}`
   - `GET /api/items/{id}/summaries/{summary_id}` 详情（拉 markdown）

## 操作步骤

TODO: 进入此阶段时再展开。展开时需先确认：
1. S1 是否已合 main（payload 字段 videoIntent / imageMode 是否稳定）
2. 是否要走 alembic（新增表必须走，但用户需授权 §4 第 4 条）
3. LLM 调用入口复用现有哪个 service（看 `backend/app/services/` 下 summary/note 相关模块）

## 验收标准（草案，进入阶段时细化）

- [ ] 结果页能看到「总结」tab，旧素材自动有 v1
- [ ] 能新建多份不同模板的总结，全部保存
- [ ] 能新建同模板的 v2/v3，不覆盖 v1
- [ ] 能删除单份总结
- [ ] 删除是软删（标 deleted_at）还是硬删（直接 DELETE）—— 进入阶段时和用户确认

## 不在本期范围

- 对比模式（S3）
- 学习视频的「按需补图」交互（S3）
