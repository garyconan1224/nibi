# 添加素材弹框 Codex 执行报告

日期：2026-06-28  
分支：`feat/exp-redesign-p1`  
计划：`docs/plans/add-material-modal-codex-2026-06-28.md`

---

## 1. 结论

- 封面/标题/简介链路本轮**无需继续改后端**：真机打开弹框后，B 站链接能补齐 title + description，`/link-preview` 返回 `200`，耗时 `4.680360s`。
- 前端已按计划收口：
  - 默认无合集语义改为 `收纳箱（单独素材）`。
  - `音频笔记` 高级设置只保留 `发言人 + 补充说明`。
  - `逐帧复刻` 新增独立 `④ 复刻设置`，展示 `画面分析 / 视觉模型 / 取画面 / 补充说明`。
- 本轮未改提交契约；仅调整展示文案、分组和显隐。

## 2. 真实数据证据

测试 URL：`https://www.bilibili.com/video/BV1GJ4m1M7Yw/`

### 2.1 `POST /workspaces/sniff-url`

```json
{
  "primary_type": "video",
  "possible_types": ["video", "audio"],
  "platform": "bilibili",
  "title": null,
  "thumbnail": null,
  "content_type_header": null,
  "confident": true
}
```

说明：B 站 sniff 仍然只做轻量识别，不直接带封面/标题。

### 2.2 `GET /link-preview`

命令：

```bash
curl -sS -o /tmp/add-material-preview.json \
  -w 'status=%{http_code} time=%{time_total}\n' \
  --get \
  --data-urlencode 'url=https://www.bilibili.com/video/BV1GJ4m1M7Yw/' \
  http://127.0.0.1:8000/link-preview
```

结果：

```text
status=200 time=4.680360
```

返回摘录：

```json
{
  "title": "第六场完美狩猎完成！然而惨案被揭开！白晨危险？13集（带12集）_哔哩哔哩_bilibili",
  "description": "第六场完美狩猎完成！然而惨案被揭开！白晨危险？13集（带12集）, 视频播放量 158533 ...",
  "image_url": "//i2.hdslb.com/bfs/archive/38f5ee46ebc54e1e7a5eaca57981bbd2a83a644b.jpg@100w_100h_1c.png",
  "source": "og"
}
```

说明：当前走的是 `source: "og"`，但封面、标题、简介都能正常补齐，所以本轮没有再继续改 `link_preview.py`。

## 3. 浏览器复核

使用 in-app browser 真机 reload 后复看，确认：

1. 默认打开弹框时，副标题与合集归属都显示 `收纳箱（单独素材）`，不再暗示自动新建具名合集。
2. `音频笔记` 下，高级设置摘要变为 `发言人 · 补充说明`，展开后不再出现 `配图 / 视觉模型 / 取画面`。
3. `逐帧复刻` 下，出现 `④ 复刻设置`，高级设置摘要为 `画面分析 · 取画面 · 视觉模型 · 补充说明`。

截图：

- `frontend/test-results/add-material-codex-default.png`
- `frontend/test-results/add-material-codex-audio.png`
- `frontend/test-results/add-material-codex-replica.png`

## 4. 代码改动

### `frontend/src/components/workspace/AddMaterialModal.tsx`

- 默认无合集标签改为 `收纳箱（单独素材）`。
- `open` 重置时补上 `advancedOpen(false)` 等默认状态恢复，保证每次重开都是折叠态。
- 新增按动作/笔记类型的设置显隐逻辑：
  - 视频笔记：保留 `配图 / 视觉模型 / 取画面 / 发言人 / 补充说明`
  - 音频笔记：只保留 `发言人 / 补充说明`
  - 复刻：新增 `④ 复刻设置`，保留 `画面分析 / 视觉模型 / 取画面 / 补充说明`
- 未改 `generateNote/savePreflight/startItemPipeline` 的请求组装结构。

### `frontend/src/__tests__/AddMaterialModal.test.tsx`

- 补了 `收纳箱（单独素材）` 语义后的行为覆盖。
- 新增 `音频笔记` 高级项显隐断言。
- 新增 `复刻设置` 可见性断言。
- 补 `linkPreview` mock，避免测试进程因真实网络副作用挂住。

## 5. 验证

### 5.1 构建

```bash
pnpm -C frontend build
```

结果：通过。

### 5.2 定向测试

```bash
CI=1 pnpm -C frontend exec vitest run \
  src/__tests__/AddMaterialModal.test.tsx \
  src/__tests__/AddMaterialModal.local.test.tsx \
  --reporter=verbose
```

结果：`2` 个测试文件、`15` 个测试全部通过。

备注：stderr 里仍有现存的 React `act(...)` 提示，但不影响通过/不通过结论；本轮未继续清理该测试噪音。

## 6. 遇停项

无。  
因为真机已确认 B 站预览能稳定补齐 title/description/image，本轮没有进入计划里的后端超时/降级策略改造分支。
