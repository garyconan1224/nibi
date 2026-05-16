import { useCallback, useState } from 'react'
import DiffViewer from 'react-diff-viewer-continued'
import { ChevronDown, GitCompare, Plus, X } from 'lucide-react'

import type { PromptVersion } from '@/services/workspaces'

interface PromptVersionStackProps {
  versions: PromptVersion[]
  onAddVersion: (content: string) => Promise<void>
}

export function PromptVersionStack({ versions, onAddVersion }: PromptVersionStackProps) {
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [diffMode, setDiffMode] = useState(false)
  const [diffLeft, setDiffLeft] = useState<PromptVersion | null>(null)
  const [diffRight, setDiffRight] = useState<PromptVersion | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleSubmit = useCallback(async () => {
    const trimmed = newContent.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await onAddVersion(trimmed)
      setNewContent('')
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }, [newContent, onAddVersion])

  const toggleDiff = useCallback(() => {
    setDiffMode((prev) => {
      if (!prev && versions.length >= 2) {
        setDiffLeft(versions[versions.length - 2])
        setDiffRight(versions[versions.length - 1])
      }
      return !prev
    })
  }, [versions])

  if (versions.length === 0 && !adding) {
    return (
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>提示词版本</div>
        <span className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>暂无版本</span>
        <button
          onClick={() => setAdding(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 8,
            height: 28,
            padding: '0 10px',
            borderRadius: 6,
            fontSize: 11,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          <Plus size={12} /> 新增版本
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 6,
        }}
      >
        <span className="eyebrow" style={{ flex: 1 }}>提示词版本</span>
        {versions.length >= 2 && (
          <button
            onClick={toggleDiff}
            title={diffMode ? '关闭 diff' : '对比版本'}
            style={{
              height: 22,
              padding: '0 6px',
              borderRadius: 4,
              fontSize: 10,
              border: diffMode ? '1px solid var(--accent)' : '1px solid var(--line)',
              background: diffMode ? 'rgba(255,77,126,0.08)' : 'transparent',
              color: diffMode ? 'var(--accent)' : 'var(--ink-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <GitCompare size={10} /> diff
          </button>
        )}
        <button
          onClick={() => setAdding(true)}
          title="新增版本"
          style={{
            height: 22,
            padding: '0 6px',
            borderRadius: 4,
            fontSize: 10,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Plus size={10} />
        </button>
      </div>

      {/* 版本下拉 */}
      {versions.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              width: '100%',
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              fontSize: 12,
              border: '1px solid var(--line)',
              background: 'var(--bg-sunken)',
              color: 'var(--ink)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>v{versions[versions.length - 1].version}（最新）</span>
            <ChevronDown size={12} />
          </button>
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 20,
                marginTop: 2,
                border: '1px solid var(--line)',
                borderRadius: 6,
                background: 'var(--bg-elev)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              {[...versions].reverse().map((pv) => (
                <button
                  key={pv.version}
                  onClick={() => {
                    setDropdownOpen(false)
                    // 切换版本时更新 diff 选择
                    if (diffMode) {
                      if (!diffLeft || diffLeft.version === pv.version) {
                        setDiffLeft(pv)
                      } else {
                        setDiffRight(pv)
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 12,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--line)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-sunken)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginRight: 6 }}>
                    v{pv.version}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {pv.content.slice(0, 60)}{pv.content.length > 60 ? '…' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 最新版本内容 */}
      {!diffMode && versions.length > 0 && (
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11.5,
            lineHeight: 1.72,
            background: 'var(--bg-sunken)',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--line)',
            color: 'var(--ink)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: 8,
          }}
        >
          {versions[versions.length - 1].content}
        </div>
      )}

      {/* Diff 视图 */}
      {diffMode && diffLeft && diffRight && (
        <div
          style={{
            marginBottom: 8,
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--line)',
            fontSize: 11,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '6px 10px',
              background: 'var(--bg-sunken)',
              borderBottom: '1px solid var(--line)',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--ink-3)' }}>
              对比 v{diffLeft.version} → v{diffRight.version}
            </span>
          </div>
          <DiffViewer
            oldValue={diffLeft.content}
            newValue={diffRight.content}
            splitView={false}
            useDarkTheme={false}
            styles={{
              variables: {
                dark: {
                  diffViewerBackground: 'var(--bg)',
                  addedBackground: 'rgba(76,175,80,0.12)',
                  removedBackground: 'rgba(244,67,54,0.12)',
                  wordAddedBackground: 'rgba(76,175,80,0.2)',
                  wordRemovedBackground: 'rgba(244,67,54,0.2)',
                  addedColor: 'var(--ink)',
                  removedColor: 'var(--ink)',
                },
              },
              contentText: {
                fontSize: 11,
                lineHeight: 1.7,
                fontFamily: 'var(--mono)',
              },
            }}
          />
        </div>
      )}

      {/* Diff 模式下的版本选择器 */}
      {diffMode && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select
            value={diffLeft?.version ?? ''}
            onChange={(e) => {
              const v = versions.find((pv) => pv.version === Number(e.target.value))
              if (v) setDiffLeft(v)
            }}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              fontSize: 11,
              border: '1px solid var(--line)',
              background: 'var(--bg-sunken)',
              color: 'var(--ink)',
              padding: '0 6px',
            }}
          >
            {versions.map((pv) => (
              <option key={pv.version} value={pv.version}>v{pv.version}</option>
            ))}
          </select>
          <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--ink-3)' }}>→</span>
          <select
            value={diffRight?.version ?? ''}
            onChange={(e) => {
              const v = versions.find((pv) => pv.version === Number(e.target.value))
              if (v) setDiffRight(v)
            }}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              fontSize: 11,
              border: '1px solid var(--line)',
              background: 'var(--bg-sunken)',
              color: 'var(--ink)',
              padding: '0 6px',
            }}
          >
            {versions.map((pv) => (
              <option key={pv.version} value={pv.version}>v{pv.version}</option>
            ))}
          </select>
        </div>
      )}

      {/* 新增版本输入 */}
      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="输入提示词内容…"
            rows={3}
            style={{
              width: '100%',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
              border: '1px solid var(--line)',
              background: 'var(--bg-sunken)',
              color: 'var(--ink)',
              padding: '8px 10px',
              resize: 'vertical',
              fontFamily: 'var(--mono)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAdding(false); setNewContent('') }}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                fontSize: 11,
                border: '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <X size={10} /> 取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !newContent.trim()}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                border: 'none',
                background: submitting || !newContent.trim() ? 'var(--ink-4)' : 'var(--ink)',
                color: 'var(--bg)',
                cursor: submitting || !newContent.trim() ? 'default' : 'pointer',
              }}
            >
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        versions.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              fontSize: 11,
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> 新增版本
          </button>
        )
      )}
    </div>
  )
}
