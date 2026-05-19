import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Star, ChevronDown, ChevronRight, Layers } from 'lucide-react'

import {
  type TextResult,
  type TextCompareResult,
  addPromptVersion,
  getTextItemResult,
  getTextCompare,
} from '@/services/workspaces'
import { PromptVersionStack } from '@/components/result/PromptVersionStack'

import './tokens.css'
import { ItemTagsPanel } from '@/components/workspace/ItemTagsPanel'

export default function TextResultPage() {
  const { workspaceId = '', itemId = '' } = useParams<{ workspaceId: string; itemId: string }>()
  const navigate = useNavigate()

  type FetchState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: TextResult }
    | { kind: 'error'; message: string }
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' })
  const [favored, setFavored] = useState(false)

  // N10: 折叠状态
  const [assocOpen, setAssocOpen] = useState(true)
  const [rewriteOpen, setRewriteOpen] = useState(true)
  const [translateOpen, setTranslateOpen] = useState(true)

  // N10: 多文对比弹窗
  const [compareState, setCompareState] = useState<
    | { kind: 'closed' }
    | { kind: 'loading' }
    | { kind: 'ready'; data: TextCompareResult }
    | { kind: 'error'; message: string }
  >({ kind: 'closed' })

  useEffect(() => {
    let cancelled = false
    getTextItemResult(workspaceId, itemId)
      .then((data) => {
        if (!cancelled) setFetchState({ kind: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载文本结果失败'
        setFetchState({ kind: 'error', message })
      })
    return () => { cancelled = true }
  }, [workspaceId, itemId])

  const result = fetchState.kind === 'ready' ? fetchState.data : null
  const promptVersions = result?.prompt_versions ?? []

  const handleAddVersion = useCallback(async (content: string) => {
    const pv = await addPromptVersion(workspaceId, itemId, content)
    setFetchState((prev) => {
      if (prev.kind !== 'ready') return prev
      return {
        kind: 'ready',
        data: { ...prev.data, prompt_versions: [...prev.data.prompt_versions, pv] },
      }
    })
    toast.success(`已保存 v${pv.version}`)
  }, [workspaceId, itemId])

  const handleFavorite = useCallback(() => {
    setFavored((prev) => {
      const next = !prev
      toast.success(next ? '已收藏此文稿' : '已取消收藏')
      return next
    })
  }, [])

  // N10: 多文对比
  const handleCompare = useCallback(async () => {
    setCompareState({ kind: 'loading' })
    try {
      const data = await getTextCompare(workspaceId, itemId)
      setCompareState({ kind: 'ready', data })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '多文对比失败'
      setCompareState({ kind: 'error', message })
    }
  }, [workspaceId, itemId])

  if (fetchState.kind === 'loading') {
    return (
      <div className="vm-video-result-scope" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>加载文本结果…</span>
      </div>
    )
  }
  if (fetchState.kind === 'error' || !result) {
    return (
      <div
        className="vm-video-result-scope"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
      >
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {fetchState.kind === 'error' ? fetchState.message : '没有可显示的文本结果'}
        </span>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
      </div>
    )
  }

  const hasAssociations = result.associations && Object.keys(result.associations).length > 0
  const hasRewrites = result.rewrites && Object.keys(result.rewrites).length > 0
  const hasTranslations = result.translations && Object.keys(result.translations).length > 0

  return (
    <div
      className="vm-video-result-scope"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ════════ 左：正文 ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶部导航 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-elev)',
          }}
        >
          <button
            className="btn-ghost"
            onClick={() => navigate(-1)}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            <ArrowLeft size={13} /> 返回
          </button>
          <span style={{ width: 1, height: 16, background: 'var(--line)', flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.title}
          </span>
          <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>TEXT</span>
        </div>

        {/* 标签展示 */}
        <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
          <ItemTagsPanel workspaceId={workspaceId} itemId={itemId} />
        </div>

        {/* 正文区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
            {result.content}
          </div>
        </div>
      </div>

      {/* ════════ 右：摘要 + 联想 + 改写翻译 + 元信息 + 版本栈 ════════ */}
      <div
        style={{
          borderLeft: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-elev)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-sunken)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span className="eyebrow">文本摘要</span>
          {/* N10: 多文对比按钮 */}
          <button
            onClick={handleCompare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid var(--line)',
              background: 'var(--bg-elev)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <Layers size={12} /> 多文对比
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {/* 摘要 */}
          {result.summary && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                {result.summary}
              </div>
            </div>
          )}

          {/* N10: 联想归纳 */}
          {hasAssociations && (
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setAssocOpen(!assocOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, marginBottom: 6,
                }}
              >
                {assocOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="eyebrow">联想归纳</span>
              </button>
              {assocOpen && (
                <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                  {Object.entries(result.associations!).map(([dir, text]) => (
                    <div key={dir} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>{dir}</div>
                      <div>{text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* N10: 改写/润色 */}
          {hasRewrites && (
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setRewriteOpen(!rewriteOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, marginBottom: 6,
                }}
              >
                {rewriteOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="eyebrow">改写 / 润色</span>
              </button>
              {rewriteOpen && (
                <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                  {Object.entries(result.rewrites!).map(([style, text]) => (
                    <div key={style} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>{style}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* N10: 翻译 */}
          {hasTranslations && (
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setTranslateOpen(!translateOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, marginBottom: 6,
                }}
              >
                {translateOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="eyebrow">翻译</span>
              </button>
              {translateOpen && (
                <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                  {Object.entries(result.translations!).map(([lang, text]) => (
                    <div key={lang} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>{lang}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 元信息 */}
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>元信息</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--ink-2)' }}>
              <div>来源类型：{result.source_type}</div>
              <div>字符数：{result.char_count.toLocaleString()}</div>
              {result.source_url && <div>来源：{result.source_url}</div>}
            </div>
          </div>

          {/* 提示词版本栈 */}
          <PromptVersionStack
            versions={promptVersions}
            onAddVersion={handleAddVersion}
          />
        </div>

        {/* 底部操作 */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleFavorite}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              cursor: 'pointer',
              border: '1px solid var(--line)',
              background: favored ? 'rgba(255,184,76,0.12)' : 'var(--bg-sunken)',
              color: favored ? 'var(--accent-warm)' : 'var(--ink-2)',
            }}
          >
            <Star
              size={14}
              fill={favored ? 'var(--accent-warm)' : 'none'}
              color={favored ? 'var(--accent-warm)' : 'currentColor'}
            />
            {favored ? '已收藏' : '收藏'}
          </button>
        </div>
      </div>

      {/* N10: 多文对比弹窗 */}
      {compareState.kind !== 'closed' && (
        <TextCompareModal
          state={compareState}
          onClose={() => setCompareState({ kind: 'closed' })}
        />
      )}
    </div>
  )
}

// ── 多文对比弹窗 ──────────────────────────────────────────────

function TextCompareModal({
  state,
  onClose,
}: {
  state:
    | { kind: 'loading' }
    | { kind: 'ready'; data: TextCompareResult }
    | { kind: 'error'; message: string }
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', borderRadius: 12, width: '80vw', maxWidth: 900,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>多文对比</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {state.kind === 'loading' && (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 40 }}>加载对比数据…</div>
          )}
          {state.kind === 'error' && (
            <div style={{ textAlign: 'center', color: 'var(--accent)', padding: 40 }}>{state.message}</div>
          )}
          {state.kind === 'ready' && (
            <TextCompareContent data={state.data} />
          )}
        </div>
      </div>
    </div>
  )
}

function TextCompareContent({ data }: { data: TextCompareResult }) {
  const items = data.texts.filter((t) => t.has_result)
  if (items.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 40 }}>没有已完成分析的文字素材</div>
  }

  return (
    <div>
      {/* 对比表格 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--line)' }}>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--ink-3)' }}>素材</th>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--ink-3)' }}>字数</th>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--ink-3)' }}>摘要</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.item_id} style={{ borderBottom: '1px solid var(--line)', background: t.is_current ? 'rgba(99,102,241,0.06)' : undefined }}>
              <td style={{ padding: '8px 6px', fontWeight: t.is_current ? 600 : 400 }}>{t.name}</td>
              <td style={{ padding: '8px 6px' }}>{t.char_count.toLocaleString()}</td>
              <td style={{ padding: '8px 6px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* LLM 对比总结 */}
      {data.llm_summary && (
        <div style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>AI 对比总结</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
            {data.llm_summary}
          </div>
        </div>
      )}
    </div>
  )
}
