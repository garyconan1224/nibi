/**
 * Milkdown WYSIWYG 编辑器 Spike 验证页
 * 路由：/test-editor（开发用，验证通过后删除）
 *
 * 验证清单：
 * 1. 编辑器正常渲染
 * 2. GFM：表格、任务列表、删除线
 * 3. 图片内联渲染
 * 4. 代码块语法高亮
 * 5. 时间码链接 [00:30](timestamp://30)
 * 6. 中文输入
 * 7. 大文档（~3000 字）性能
 */
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

/** 测试 Markdown（覆盖 GFM 表格/任务列表/图片/代码/时间码链接） */
const TEST_MD = `# Milkdown Spike 验证

## 一、基础排版

这是一段普通文字。支持 **加粗**、*斜体*、~~删除线~~ 和 \`行内代码\`。

> 这是引用块，可以用来高亮重要信息。

---

## 二、列表

### 无序列表
- 第一项
- 第二项
  - 嵌套子项

### 有序列表
1. 步骤一
2. 步骤二
3. 步骤三

### 任务列表（GFM）
- [x] 已完成的任务
- [ ] 待办任务
- [ ] 另一个待办

## 三、表格（GFM）

| 功能 | 状态 | 说明 |
|---|---|---|
| 加粗 | ✅ | markdown 语法 |
| 表格 | ✅ | GFM 扩展 |
| 图片 | ✅ | 内联渲染 |

## 四、代码块

\`\`\`typescript
function hello(name: string): string {
  return \`你好，\${name}！\`
}
\`\`\`

## 五、时间码链接（自定义语法）

视频中提到的重点时刻：
- [00:30](timestamp://30) 开场介绍
- [02:15](timestamp://135) 核心观点
- [05:00](timestamp://300) 总结

## 六、图片

![测试图片](https://picsum.photos/400/200)

## 七、长文本性能测试

${'这是一段重复的长文本，用于测试大文档下的编辑性能。'.repeat(50)}
`

export default function TestEditorPage() {
  return (
    <MilkdownProvider>
      <TestEditorContent />
    </MilkdownProvider>
  )
}

function TestEditorContent() {
  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, TEST_MD)
        ctx.get(listenerCtx).markdownUpdated((_ctx, md) => {
          console.log('[Milkdown] doc length:', md.length)
        })
      })
      // @ts-expect-error Milkdown 7.x TS overload 不精确，运行时正常
      .use(nord)
      .use(commonmark)
      .use(gfm)
      .use(prism)
      .use(listener)
  }, [])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontSize: 16, color: 'var(--ink-2, #444)', marginBottom: 16 }}>
        Milkdown WYSIWYG Spike 验证
      </h2>
      <div
        style={{
          border: '1px solid var(--line, #e0e0e0)',
          borderRadius: 8,
          padding: 24,
          minHeight: 400,
          background: 'var(--bg, #fff)',
        }}
      >
        <style>{`
          /* Task list checkbox — override nord theme bullet for [data-item-type="task"] */
          .milkdown-theme-nord li[data-item-type="task"] {
            list-style: none;
          }
          .milkdown-theme-nord li[data-item-type="task"]::before {
            content: "";
            display: inline-block;
            width: 1em;
            height: 1em;
            margin-right: 0.4em;
            border: 1.5px solid currentColor;
            border-radius: 3px;
            vertical-align: -2px;
          }
          .milkdown-theme-nord li[data-item-type="task"][data-checked="true"]::before {
            content: "✓";
            text-align: center;
            line-height: 1em;
            font-size: 0.85em;
          }

          /* Code block syntax highlighting — GitHub Dark tokens on pre[data-language] */
          .milkdown pre .token.keyword    { color: #ff7b72; }
          .milkdown pre .token.string,
          .milkdown pre .token.template-string.string { color: #a5d6ff; }
          .milkdown pre .token.function   { color: #d2a8ff; }
          .milkdown pre .token.number,
          .milkdown pre .token.boolean    { color: #79c0ff; }
          .milkdown pre .token.operator   { color: #ff7b72; }
          .milkdown pre .token.punctuation { color: #8b949e; }
          .milkdown pre .token.comment    { color: #6a737d; font-style: italic; }
          .milkdown pre .token.builtin,
          .milkdown pre .token.class-name { color: #ffa657; }
          .milkdown pre .token.template-punctuation { color: #a5d6ff; }
          .milkdown pre .token.interpolation { color: #c9d1d9; }
        `}</style>
        <Milkdown />
      </div>
    </div>
  )
}
