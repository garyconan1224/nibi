import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Star, ChevronDown, ChevronRight, Layers, Copy, Check } from 'lucide-react'

import {
  type TextResult,
  type TextCompareResult,
  type StructuredSummary,
  type MaybeAligned,
  normalizeAligned,
  addPromptVersion,
  getTextItemResult,
  getTextCompare,
} from '@/services/workspaces'
import { PromptVersionStack } from '@/components/result/PromptVersionStack'

import './tokens.css'
import './text-result.css'
import { ItemTagsPanel } from '@/components/workspace/ItemTagsPanel'
import { SummariesTab } from '@/components/SummariesTab'

function renderSummary(
  summary: string | StructuredSummary | null | undefined,
  scrollToParagraph: (paraIndex: number) => void,
) {
  if (!summary) return null

  // 兼容旧版纯字符串摘要
  if (typeof summary === 'string') {
    return (
      <div className="im-section">
        <div className="tx-summary-text">{summary}</div>
      </div>
    )
  }

  // T1.1: 结构化摘要
  const { abstract, key_points, golden_quotes } = summary
  return (
    <>
      {abstract && (
        <div className="im-section">
          <div className="eyebrow" style={{ marginBottom: 6 }}>摘要</div>
          <div className="tx-summary-text">{abstract}</div>
        </div>
      )}

      {key_points && key_points.length > 0 && (
        <div className="im-section">
          <div className="eyebrow" style={{ marginBottom: 8 }}>要点</div>
          <div className="tx-kp-list">
            {key_points.map((kp, i) => (
              <div
                key={i}
                className="tx-kp-item"
                data-clickable={kp.para_index !== undefined}
                onClick={kp.para_index !== undefined ? () => scrollToParagraph(kp.para_index!) : undefined}
              >
                <span className="tx-kp-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="tx-kp-body">
                  <div className="tx-kp-text">{kp.text}</div>
                  {kp.source_excerpt && (
                    <div className="tx-kp-excerpt">
                      <span className="tx-kp-excerpt-label">原文：</span>
                      {kp.source_excerpt}
                      {kp.para_index !== undefined && (
                        <span className="tx-kp-pos">第 {kp.para_index + 1} 段</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {golden_quotes && golden_quotes.length > 0 && (
        <div className="im-section">
          <div className="eyebrow" style={{ marginBottom: 8 }}>金句</div>
          <div className="tx-gq-list">
            {golden_quotes.map((q, i) => (
              <div
                key={i}
                className="tx-gq-item"
                data-clickable={q.para_index !== undefined}
                onClick={() => scrollToParagraph(q.para_index)}
              >
                <blockquote className="tx-gq-text">{q.quote_text}</blockquote>
                {q.para_index !== undefined && (
                  <span className="tx-gq-pos">第 {q.para_index + 1} 段</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── T1.2: 逐段对照视图 ──────────────────────────────────────

function ParagraphAlignView({
  originalContent,
  result,
  label,
}: {
  originalContent: string
  result: MaybeAligned | undefined
  label: string
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const section = normalizeAligned(result)
  if (!section) return null

  const origParas = originalContent.split(/\n{2,}/).filter(p => p.trim())
  const resultParas = section.paragraphs
  const maxLen = Math.max(origParas.length, resultParas.length)
  const mismatch = origParas.length !== resultParas.length

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1800)
    } catch {
      // fallback: ignore clipboard errors
    }
  }

  return (
    <div className="tx-align-container">
      {mismatch && (
        <div className="tx-align-mismatch-banner">
          段落数不一致：原文 {origParas.length} 段，{label} {resultParas.length} 段，已按序号对齐
        </div>
      )}
      {Array.from({ length: maxLen }, (_, i) => {
        const orig = origParas[i]
        const res = resultParas[i]
        return (
          <div key={i} className="tx-align-row">
            <span className="tx-align-idx">{String(i + 1).padStart(2, '0')}</span>
            <div className="tx-align-cols">
              <div className="tx-align-cell tx-align-orig">
                <div className="tx-align-cell-label">原文</div>
                <div className="tx-align-cell-text">
                  {orig || <span className="tx-align-missing">（无对应段落）</span>}
                </div>
                {orig && (
                  <button
                    className="tx-align-copy"
                    onClick={() => handleCopy(orig, i * 2)}
                  >
                    {copiedIdx === i * 2 ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <div className="tx-align-cell tx-align-result">
                <div className="tx-align-cell-label">{label}</div>
                <div className="tx-align-cell-text">
                  {res || <span className="tx-align-missing">（无对应段落）</span>}
                </div>
                {res && (
                  <button
                    className="tx-align-copy"
                    onClick={() => handleCopy(res, i * 2 + 1)}
                  >
                    {copiedIdx === i * 2 + 1 ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TextResultPage() {
  const { workspaceId = '', itemId = '' } = useParams<{ workspaceId: string; itemId: string }>()
  const navigate = useNavigate()

  type FetchState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: TextResult }
    | { kind: 'error'; message: string }
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' })
  const [favored, setFavored] = useState(false)
  const [highlightedPara, setHighlightedPara] = useState<number | null>(null)

  // N10: 折叠状态
  const [assocOpen, setAssocOpen] = useState(true)
  const [rewriteOpen, setRewriteOpen] = useState(true)
  const [translateOpen, setTranslateOpen] = useState(true)
  const [contentTab, setContentTab] = useState<'content' | 'summary'>('content')

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

  const scrollToParagraph = useCallback((paraIndex: number) => {
    const el = document.getElementById(`tx-para-${paraIndex}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedPara(paraIndex)
    setTimeout(() => setHighlightedPara(null), 2200)
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
      <div className="vm-text-scope" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>加载文本结果…</span>
      </div>
    )
  }
  if (fetchState.kind === 'error' || !result) {
    return (
      <div
        className="vm-text-scope"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
      >
        <span style={{ color: 'var(--accent-pink)', fontWeight: 600 }}>
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
    <div className="vm-text-scope tx-layout">
      {/* ════════ 左：正文 ════════ */}
      <div className="tx-left">
        {/* 顶部导航 */}
        <div className="vd-nav">
          <button className="btn-ghost" onClick={() => navigate(-1)} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
            <ArrowLeft size={13} /> 返回
          </button>
          <span className="vd-sep" />
          <span className="vd-title">{result.title}</span>
          <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>TEXT</span>
        </div>

        {/* 标签展示 */}
        <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
          <ItemTagsPanel workspaceId={workspaceId} itemId={itemId} />
        </div>

        {/* 正文区域 */}
        <div className="tx-content-scroll">
          <div className="tx-content-body">
            {result.content.split(/\n{2,}/).map((para, i) => (
              <div
                key={i}
                id={`tx-para-${i}`}
                className="tx-para"
                data-highlight={highlightedPara === i}
              >
                {para}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ 右：摘要 + 联想 + 改写翻译 + 元信息 + 版本栈 ════════ */}
      <div className="tx-right">
        <div className="tx-right-header">
          <div style={{ display: 'flex', gap: 0 }}>
            <button className="vd-tab-btn" data-active={contentTab === 'content'} onClick={() => setContentTab('content')}>
              摘要
            </button>
            <button className="vd-tab-btn" data-active={contentTab === 'summary'} onClick={() => setContentTab('summary')}>
              总结
            </button>
          </div>
          {contentTab === 'content' && (
            <button className="tx-compare-btn" onClick={handleCompare}>
              <Layers size={12} /> 多文对比
            </button>
          )}
        </div>

        <div className="tx-right-scroll">
          {contentTab === 'summary' ? (
            <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
              <SummariesTab workspaceId={workspaceId} itemId={itemId} />
            </div>
          ) : (
          <>
          {/* 摘要 — T1.1: 支持结构化摘要 */}
          {renderSummary(result.summary, scrollToParagraph)}

          {/* N10: 联想归纳 */}
          {hasAssociations && (
            <div className="im-section">
              <button className="tx-collapse-btn" onClick={() => setAssocOpen(!assocOpen)}>
                {assocOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="eyebrow">联想归纳</span>
              </button>
              {assocOpen && (
                <div className="tx-section-body">
                  {Object.entries(result.associations!).map(([dir, text]) => (
                    <div key={dir} className="tx-section-item">
                      <div className="tx-section-item-label">{dir}</div>
                      <div>{text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* T1.2: 改写/润色 — 逐段对照 */}
          {hasRewrites && (
            <div className="im-section">
              <button className="tx-collapse-btn" onClick={() => setRewriteOpen(!rewriteOpen)}>
                {rewriteOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="eyebrow">改写 / 润色</span>
              </button>
              {rewriteOpen && (
                <div className="tx-section-body">
                  {Object.entries(result.rewrites!).map(([style, val]) => (
                    <div key={style} className="tx-section-item">
                      <div className="tx-section-item-label">{style}</div>
                      <ParagraphAlignView
                        originalContent={result.content}
                        result={val}
                        label={style}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* T1.2: 翻译 — 逐段对照 */}
          {hasTranslations && (
            <div className="im-section">
              <button className="tx-collapse-btn" onClick={() => setTranslateOpen(!translateOpen)}>
                {translateOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="eyebrow">翻译</span>
              </button>
              {translateOpen && (
                <div className="tx-section-body">
                  {Object.entries(result.translations!).map(([lang, val]) => (
                    <div key={lang} className="tx-section-item">
                      <div className="tx-section-item-label">{lang}</div>
                      <ParagraphAlignView
                        originalContent={result.content}
                        result={val}
                        label={lang}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 元信息 */}
          <div className="im-section">
            <div className="eyebrow" style={{ marginBottom: 6 }}>元信息</div>
            <div className="tx-meta-body">
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
          </>
          )}
        </div>

        {/* 底部操作 */}
        <div className="tx-actions">
          <button
            className="tx-btn-sub"
            data-favored={favored}
            onClick={handleFavorite}
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
    <div className="vm-text-scope tx-compare-overlay" onClick={onClose}>
      <div className="tx-compare-panel" onClick={(e) => e.stopPropagation()}>
        <div className="tx-compare-header">
          <span className="tx-compare-title">多文对比</span>
          <button className="tx-compare-close" onClick={onClose}>×</button>
        </div>
        <div className="tx-compare-body">
          {state.kind === 'loading' && (
            <div className="tx-compare-status">加载对比数据…</div>
          )}
          {state.kind === 'error' && (
            <div className="tx-compare-status" data-error="true">{state.message}</div>
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
    return <div className="tx-compare-status">没有已完成分析的文字素材</div>
  }

  return (
    <div>
      {/* 对比表格 */}
      <table className="tx-compare-table">
        <thead>
          <tr>
            <th>素材</th>
            <th>字数</th>
            <th>摘要</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.item_id} data-current={t.is_current}>
              <td className="name-cell" data-current={t.is_current}>{t.name}</td>
              <td>{t.char_count.toLocaleString()}</td>
              <td className="summary-cell">{typeof t.summary === 'string' ? t.summary : (t.summary?.abstract ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* LLM 对比总结 */}
      {data.llm_summary && (
        <div style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>AI 对比总结</div>
          <div className="tx-compare-summary">
            {data.llm_summary}
          </div>
        </div>
      )}
    </div>
  )
}
