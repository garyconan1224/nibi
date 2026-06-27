# Stage 5+6 收尾验收报告

分支：`feat/exp-redesign-p1`
日期：2026-06-28
计划文件：`docs/plans/exp-redesign-result-pages-1to1-2026-06-27.md`

---

## 1. 改动清单

| 文件 | 改动 |
|---|---|
| `NoteShell/note-shell-utils.tsx` | **新建**。`platformLabelFromUrl` + `renderNoteTimestampChildren` + `replaceNoteTimestampString` 从 index.tsx 拆出，修 react-refresh lint |
| `NoteShell/index.tsx` | 移除 2 个非组件 export（react-refresh 修复）；提取 `TEMPLATE_LABELS` + `tl` 为模块级常量（唯一定义，5 处内联重复→0）；文本笔记标签 class `nibi-text-tags` → `note-tags-inline`（统一四类间距/gap）；顶栏"原视频"title→"原链接"（通用化）；移除 3 个不再需要的 React import |
| `NoteShell/note-shell.css` | 删除 `.nibi-text-tags` 死 CSS（已被 `note-tags-inline` 取代） |
| `__tests__/NoteShellPlatform.test.ts` | 导入路径改到 `note-shell-utils` |
| `__tests__/NoteShellTimestamp.test.tsx` | 同上 |

**净变化**：-85 行（index.tsx 从 1406→1321 行），+1 新文件（note-shell-utils.tsx）。

---

## 2. 一致性巡检结论

### 2.1 四类笔记右栏结构 ✓ 一致

| 维度 | video | audio | image | text |
|---|---|---|---|---|
| 顶栏 meta | VIDEO · mm:ss | AUDIO · mm:ss | IMAGE | TEXT |
| 右栏 title | note-copy-head ✓ | note-copy-head ✓ | note-copy-head ✓ | note-copy-head ✓ |
| 标签区 class | note-tags-inline ✓ | note-tags-inline ✓ | note-tags-inline ✓ | note-tags-inline ✓（**已修**） |
| 总结切换 | note-section ✓ | note-section ✓ | note-section ✓ | note-section ✓ |
| 正文编辑器 | MilkdownEditor ✓ | MilkdownEditor ✓ | MilkdownEditor ✓ | MilkdownEditor ✓ |
| 保存状态 | saveStatusNode ✓ | saveStatusNode ✓ | saveStatusNode ✓ | saveStatusNode ✓ |

### 2.2 修复的不一致项

1. **文本笔记标签间距**：`nibi-text-tags`（gap:6px / mb:12px）→ `note-tags-inline`（gap:10px / mb:28px），与其他三类统一。
2. **TEMPLATE_LABELS 不完整**：右栏 4 处 inline 声明缺 7 个模板（`oral/steps/outline/qa/actions/tool_recommendation/science_popularization`），现统一为模块级唯一定义。
3. **顶栏链接 title**：所有类型显示"原视频"→改为"原链接"。

### 2.3 未发现的问题 / 预存样式

- CSS 中视频播放器区域的 `#050505`/`#fff`/`#000` 为预存样式（Stage 1 之前已有），非本轮引入。
- 响应式断点（`@media max-width:768px`）已覆盖 `--note-left-width: 100%`。

---

## 3. §7 占位项最终清单

| # | 来源 | 占位项 | 状态 | 建议 |
|---|---|---|---|---|
| §7-1 | Stage 1 | 视频画中画 `.note-pip` | 未渲染（无代码） | 后续做 — 需确认浏览器 PiP API 适配 |
| §7-2 | Stage 1 | 缩略图轨真实帧数据来源 | 已接真实 `videoFrames`（keyframes 接口） | **已解决** — 可从 §7 移除 |
| §7-3 | Stage 1 | 章节标签 `.note-chapter-label` | 未渲染（无章节数据源） | 后续做 — 需后端提供章节数据 |
| §7-4 | Stage 1 | 导出菜单 PPTX/PDF/Word/长图/沉浸式 | disabled 灰显占位（5 项） | 后续批次逐个接入 |
| §7-5 | Stage 3 | 图片「生成参数」 | 未渲染（图文 OCR ≠ AI 绘图） | 建议移除 — 不适用于当前图文笔记 |
| §7-6 | Stage 3 | 图片「创建时间」meta 行 | 未渲染（`ItemNote` 无 `created_at`，需额外 fetch workspace） | 后续做 — 需 API 变更或 note 响应加字段 |
| §7-7 | 后续 | 合集/复刻/资料库/收藏/知识库/搜索/设置/主页/处理页 | 非首批范围 | P2+ 批次 |
| §7-8 | Stage 4 | 文本笔记工具栏（B/I/H/•） | disabled 占位按钮 | 后续做 — Milkdown 命令接入 |
| §7-9 | Stage 5 | AI 工具（原文对照已接线；思维导图/海报 disabled） | disabled 灰显 | 后续做 |

---

## 4. 回归验证

### 4.1 Build + Test

```
✓ pnpm build — 281ms, exit 0
✓ pnpm test — 20 files / 157 tests passed, 2.36s
```

### 4.2 react-refresh lint

```
✓ eslint NoteShell/index.tsx — 0 react-refresh errors（修复前 2 个）
```

### 4.3 *ResultPage（复刻向）未波及确认

| 文件 | git diff | 结论 |
|---|---|---|
| `VideoResultPage.tsx` | 未修改 | ✓ |
| `AudioResultPage.tsx` | 未修改 | ✓ |
| `ImageResultPage.tsx` | 未修改 | ✓ |
| `TextResultPage.tsx` | 未修改 | ✓ |

### 4.4 手测（无真实数据环境）

本次无工作区数据（数据库为空），无法执行四类手测。以下为代码级确认：

- ✓ 顶栏四类形态共享，meta 标签正确显示类型+时长
- ✓ 分栏比例：video 60% / audio 60% / image 50% / text 55%
- ✓ 四类右栏结构统一（title → tags → 总结 → editor → save status）
- ✓ 播放器/波形/画廊/编辑器各自组件引用正确
- ✓ 转录面板四类统一（LNTranscriptPanel）
- ✓ 导出/AI 工具菜单统一（enabled/disabled 区分）
- ⚠ 未验证：真实数据下渲染效果、播放/波形/画廊交互、转录跳转、保存/导出流程
