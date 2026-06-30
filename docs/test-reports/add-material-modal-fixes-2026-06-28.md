# 添加素材弹框 3 项修复 — 交付报告

日期：2026-06-28
分支：`feat/exp-redesign-p1`

---

## §1 接口真实返回字段清单（证据）

测试 URL: `https://www.bilibili.com/video/BV1GJ4m1M7Yw/`

### `POST /workspaces/sniff-url`

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

> B站是已知平台，sniff 走 O(1) 不发 HTTP → title、thumbnail 为 null。封面/标题需 link-preview 补。

### `GET /link-preview?url=...`

```json
{
  "title": "第六场完美狩猎完成！然而惨案被揭开！…_bilibili",
  "description": "…",
  "image_url": "//i2.hdslb.com/...@100w_100h_1c.png",
  "source": "og"
}
```

> **注意**：link-preview 对 B站返回 `source: "og"`（未走 `BilibiliNoCookieDownloader` 的 `source: "bili"` 路径，因为 B站 downloader import 失败或 bvid 提取失败导致降级）。但 og 路径仍返回了 `image_url` 和 `title`，封面可用。
> 实际使用仍应优先级 `BilibiliNoCookieDownloader`（返回 `source: "bili"` + `meta.cover_url`），但当前 OG 降级也已覆盖。

### `POST /workspaces/probe-duration`

```json
{ "duration_sec": 787 }
```

### SniffResult 类型定义的字段

```typescript
interface SniffResult {
  primary_type: 'video' | 'audio' | 'image' | 'text'
  possible_types: string[]
  platform: string | null
  title: string | null
  thumbnail: string | null
  content_type_header: string | null
  confident?: boolean
  error?: string
}
```

**后端 SniffResult 没有 uploader / description / play_count / duration 字段**。前端只显示确认存在的字段。

---

## §2 逐项改动

### 2.1 识别卡显示封面 + 视频信息

**文件**：`AddMaterialModal.tsx`

**改动**：
1. 新增 `linkTitle` state，link-preview 返回标题时补充到识别卡。
2. 修改 link-preview useEffect 触发条件：原逻辑只在 sniff 没 thumbnail 时调 link-preview → 改为 sniff 缺 thumbnail **或** 缺 title 时都调（补充标题）。
3. 识别卡标题优先级：`effectiveSniff.title` → `linkTitle` → 兜底"已识别视频/音频/..."。
4. `sourceSummary` 同理使用 `linkTitle`。
5. `open` 重置时清空 `coverUrl` + `linkTitle`。

**CSS**：缩略图 72×50 → 52×52 对齐设计稿。

**验收**：
- 构筑+测试全绿 (20 files / 158 tests)。
- 输入 B站链接后，link-preview title 补到识别卡标题，封面由 link-preview 补→显示真实封面。

### 2.2 弹框太长 → 高级设置折叠

**文件**：`AddMaterialModal.tsx` + `nibi-components.css`

**改动**：
1. 笔记设置区保留「笔记类型」(4 张卡) + 「笔记风格」选择器可见。
2. 以下项收入折叠 accordion（默认折叠）：
   - 笔记里配图（Switch）
   - 视觉模型（Select，配图开+有视觉模型时显示）
   - 取画面（智能/手动，配图开+视频+有视觉模型时显示）
   - 区分发言人（Switch）
   - 补充说明（Textarea）
3. 折叠按钮 `.accordion-trigger`：inline 图标 + 标签 + 子项摘要 + ChevronDown 箭头（展开时旋转 180°）。
4. **默认值不变**：折叠只影响显隐（CSS display），所有 state 和提交 payload 与改前一致。

**验收**：首屏明显变短；展开「高级设置」全部原有功能在位。

### 2.3 选择合集处加「新建合集」入口

**文件**：`AddMaterialModal.tsx`

**改动**：
1. 导入 `createWorkspace as createWorkspaceSvc`。
2. 合集归属行右侧新增独立"新建合集"按钮（始终可见，不受 `availableWorkspaces` 有无影响）。
3. `handleCreateWorkspace` 改为双路径：
   - `onCreateWorkspace` 传入 → 走父组件（Composer 已有）。
   - 未传入（TaskboardPage）→ 直接用 `createWorkspaceSvc` 创建。
4. TaskboardPage 原本不传 `onCreateWorkspace`/`availableWorkspaces`/`onWorkspaceIdsChange`，现在至少能新建合集并 toast 提示。

**验收**：TaskboardPage 点"新建合集"弹出 toast "合集「xxx」已创建"。Composer picker 中的"新建合集"不受影响。

---

## §3 遇停/待后端补字段

- **UP主/播放量/简介**：后端 SniffResult 和 LinkPreviewResult 均无这些字段（link-preview description 是相关视频合集文字，非 UP主信息），识别卡不显示这些。
- B站 link-preview 走 OG 降级（`source: "og"`）而非 bilibili downloader。若需 UP主/播放量等字段，需要后端在 link-preview 的 B站专用路径中补充返回。

---

## §4 构建+测试

```
npm run build → ✓ built in 310ms
npm test → 20 files / 158 tests passed (2.69s)
```
