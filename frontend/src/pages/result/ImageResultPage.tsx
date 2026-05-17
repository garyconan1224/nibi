import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check, Copy, Download, Settings2, Star } from 'lucide-react'

import {
  type ImageResult,
  type PromptVersion,
  addPromptVersion,
  downloadExport,
  getImageResult,
  listPromptVersions,
} from '@/services/workspaces'
import { PromptVersionStack } from '@/components/result/PromptVersionStack'
import {
  type PromptFormat,
  type PromptFormatsConfig,
  getPromptFormatsConfig,
  imageToFrameAdapter,
  isJsonFormat,
  renderJsonForImage,
  renderTemplate,
  savePromptFormatsConfig,
} from '@/services/promptFormats'

import './tokens.css'

const ACTIVE_LIMIT = 3

interface TabDescriptor {
  key: string
  label: string
  format: PromptFormat
}

export default function ImageResultPage() {
  const { workspaceId = '', itemId = '' } = useParams<{ workspaceId: string; itemId: string }>()
  const navigate = useNavigate()

  type FetchState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: ImageResult }
    | { kind: 'error'; message: string }
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' })

  const [promptStyle, setPromptStyle] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [favored, setFavored] = useState(false)
  const [formatsCfg, setFormatsCfg] = useState<PromptFormatsConfig | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelection, setPickerSelection] = useState<string[]>([])
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])

  // 拉提示词格式配置
  useEffect(() => {
    let cancelled = false
    getPromptFormatsConfig()
      .then((data) => {
        if (!cancelled) setFormatsCfg(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // 拉图片结果 + 提示词版本（合并为单个 effect 避免重复 cleanup）
  useEffect(() => {
    let cancelled = false
    getImageResult(workspaceId, itemId)
      .then((data) => {
        if (!cancelled) setFetchState({ kind: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载图片结果失败'
        setFetchState({ kind: 'error', message })
      })
    listPromptVersions(workspaceId, itemId)
      .then((data) => {
        if (!cancelled) setPromptVersions(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [workspaceId, itemId])

  const result = fetchState.kind === 'ready' ? fetchState.data : null

  // 构造 tabs：复用 VideoResultPage 的逻辑
  const tabs = useMemo<TabDescriptor[]>(() => {
    const formats = formatsCfg?.formats ?? []
    const imageFormats = formats.filter((f) => f.category === 'image')
    if (!imageFormats.length) return []
    const idMap = new Map(imageFormats.map((f) => [f.id, f]))
    const active = formatsCfg?.active_image_ids ?? []
    const picked: PromptFormat[] = []
    for (const id of active) {
      const fmt = idMap.get(id)
      if (fmt && !isJsonFormat(fmt) && !picked.find((p) => p.id === fmt.id)) {
        picked.push(fmt)
      }
    }
    if (picked.length < ACTIVE_LIMIT) {
      for (const fmt of imageFormats) {
        if (picked.length >= ACTIVE_LIMIT) break
        if (isJsonFormat(fmt)) continue
        if (!picked.find((p) => p.id === fmt.id)) picked.push(fmt)
      }
    }
    const jsonFmt = imageFormats.find((f) => isJsonFormat(f))
    const built: TabDescriptor[] = picked.slice(0, ACTIVE_LIMIT).map((f) => ({
      key: f.id,
      label: f.name,
      format: f,
    }))
    if (jsonFmt) built.push({ key: jsonFmt.id, label: jsonFmt.name, format: jsonFmt })
    return built
  }, [formatsCfg])

  const activeTab = tabs.find((t) => t.key === promptStyle) ?? tabs[0]

  const promptText = useMemo(() => {
    if (!result || !activeTab) return ''
    if (isJsonFormat(activeTab.format)) return renderJsonForImage(result)
    const frame = imageToFrameAdapter(result)
    return renderTemplate(activeTab.format.template, frame)
  }, [result, activeTab])

  const handleCopy = useCallback(() => {
    if (!promptText) return
    navigator.clipboard?.writeText(promptText).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [promptText])

  const handleFavorite = useCallback(() => {
    setFavored((prev) => {
      const next = !prev
      toast.success(next ? '已收藏此图' : '已取消收藏')
      return next
    })
  }, [])

  const handleExport = useCallback(async () => {
    try {
      await downloadExport(workspaceId, itemId)
      toast.success('工作包已下载')
    } catch (err) {
      toast.error('导出失败：' + (err instanceof Error ? err.message : '未知'))
    }
  }, [workspaceId, itemId])

  const handleAddPromptVersion = useCallback(async (content: string) => {
    const pv = await addPromptVersion(workspaceId, itemId, content)
    setPromptVersions((prev) => [...prev, pv])
    toast.success(`已保存 v${pv.version}`)
  }, [workspaceId, itemId])

  const openPicker = useCallback(() => {
    if (!formatsCfg) return
    setPickerSelection(tabs.filter((t) => !isJsonFormat(t.format)).map((t) => t.key))
    setPickerOpen(true)
  }, [formatsCfg, tabs])

  const togglePickerId = useCallback((id: string) => {
    setPickerSelection((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= ACTIVE_LIMIT) {
        toast.error(`最多选 ${ACTIVE_LIMIT} 个`)
        return cur
      }
      return [...cur, id]
    })
  }, [])

  const savePicker = useCallback(async () => {
    if (!formatsCfg) return
    if (pickerSelection.length !== ACTIVE_LIMIT) {
      toast.error(`请选满 ${ACTIVE_LIMIT} 个`)
      return
    }
    try {
      const saved = await savePromptFormatsConfig({ active_image_ids: pickerSelection })
      setFormatsCfg(saved)
      setPickerOpen(false)
      toast.success('已更新提示词格式 tabs')
    } catch (err) {
      toast.error('保存失败：' + (err instanceof Error ? err.message : '未知'))
    }
  }, [formatsCfg, pickerSelection])

  // 键盘快捷键：C 复制、F 收藏、1-9 切 tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === 'c' || e.key === 'C') handleCopy()
      else if (e.key === 'f' || e.key === 'F') handleFavorite()
      else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1
        if (idx < tabs.length) setPromptStyle(tabs[idx].key)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCopy, handleFavorite, tabs])

  if (fetchState.kind === 'loading') {
    return (
      <div className="vm-video-result-scope" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>加载图片结果…</span>
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
          {fetchState.kind === 'error' ? fetchState.message : '没有可显示的图片结果'}
        </span>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
      </div>
    )
  }

  return (
    <div
      className="vm-video-result-scope"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ════════ 左：原图全尺寸 ════════ */}
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
            <ArrowLeft size={13} /> 任务中心
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
            {result.image.title}
          </span>
          <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>IMAGE</span>
          {result.source === 'demo_fixture' && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'var(--accent-warm)',
                color: '#fff',
                fontWeight: 600,
              }}
              title="results 尚未填充，正在使用 demo fixture"
            >
              DEMO
            </span>
          )}
          <button
            className="btn-ghost"
            onClick={handleExport}
            title="导出复刻工作包 (.zip)"
            style={{ height: 28, padding: '0 10px', fontSize: 12, flexShrink: 0 }}
          >
            <Download size={13} /> 导出
          </button>
        </div>

        {/* 原图区域 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            overflow: 'auto',
            background: 'var(--bg-sunken)',
          }}
        >
          <img
            src={result.image.image_url}
            alt={result.image.title}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
            }}
          />
        </div>
      </div>

      {/* ════════ 右：信息面板 ════════ */}
      <div
        style={{
          borderLeft: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-elev)',
          overflow: 'hidden',
        }}
      >
        {/* 提示词 tabs 标题行 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '10px 14px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-sunken)',
          }}
        >
          <span className="eyebrow" style={{ flex: 1 }}>提示词格式</span>
          <button
            onClick={openPicker}
            title="选择 3 个图片类格式作为 tabs（JSON 自动附加）"
            style={{
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              fontSize: 10,
              fontFamily: 'var(--mono)',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Settings2 size={11} /> 选择
          </button>
        </div>

        {/* tabs 按钮行 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px 8px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-sunken)',
            overflowX: 'auto',
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setPromptStyle(t.key)}
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: promptStyle === t.key ? 'var(--ink)' : 'transparent',
                color: promptStyle === t.key ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >
              {t.label}
            </button>
          ))}
          {!tabs.length && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              （提示词格式未加载）
            </span>
          )}
        </div>

        {/* 可滚动内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {/* 提示词文本 */}
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              lineHeight: 1.72,
              background: 'var(--bg-sunken)',
              padding: '12px 13px',
              borderRadius: 12,
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 14,
            }}
          >
            {promptText}
          </div>

          {/* 内容识别描述 */}
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>内容识别描述</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)' }}>
              {result.description}
            </div>
          </div>

          {/* OCR 提取文字（如有） */}
          {result.ocr_text && (
            <div style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>OCR 提取文字</div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--ink-2)',
                  background: 'var(--bg-sunken)',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {result.ocr_text}
              </div>
            </div>
          )}

          {/* 标签 */}
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>标签</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(result.tags).flatMap(([category, values]) =>
                values.map((v) => (
                  <span key={`${category}-${v}`} className="kw" style={{ fontSize: 10 }}>
                    {v}
                  </span>
                )),
              )}
            </div>
          </div>

          {/* EXIF 信息 */}
          {(result.exif?.time || result.exif?.location) && (
            <div style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>EXIF 信息</div>
              <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--ink-2)' }}>
                {result.exif?.time && <div>拍摄时间：{result.exif.time}</div>}
                {result.exif?.location && <div>拍摄地点：{result.exif.location}</div>}
              </div>
            </div>
          )}

          {/* 提示词版本栈 */}
          <div style={{ marginTop: 14 }}>
            <PromptVersionStack
              versions={promptVersions}
              onAddVersion={handleAddPromptVersion}
            />
          </div>
        </div>

        {/* 底部操作按钮 */}
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
            onClick={handleCopy}
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
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制！' : '一键复制提示词'}
          </button>
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
            {favored ? '已收藏此图 ★' : '收藏此图'}
          </button>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'center' }}>
            快捷键：C 复制 · F 收藏 · 1/2/3 切格式
          </span>
        </div>
      </div>

      {/* FormatPicker 弹窗 */}
      {pickerOpen && formatsCfg && (
        <FormatPicker
          allFormats={formatsCfg.formats.filter((f) => f.category === 'image' && !isJsonFormat(f))}
          selection={pickerSelection}
          onToggle={togglePickerId}
          onCancel={() => setPickerOpen(false)}
          onSave={savePicker}
        />
      )}
    </div>
  )
}

// ── FormatPicker 弹窗（复用 VideoResultPage 的实现） ───────

interface FormatPickerProps {
  allFormats: PromptFormat[]
  selection: string[]
  onToggle: (id: string) => void
  onCancel: () => void
  onSave: () => void
}

function FormatPicker({ allFormats, selection, onToggle, onCancel, onSave }: FormatPickerProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 18,
          width: 420,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>选择 3 个图片类格式</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            选中的格式将作为提示词 tabs 显示，JSON 格式始终附加在末尾。
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {allFormats.map((fmt) => {
            const selected = selection.includes(fmt.id)
            return (
              <button
                key={fmt.id}
                onClick={() => onToggle(fmt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: selected ? 'rgba(255,77,126,0.06)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: selected ? 'none' : '1.5px solid var(--ink-4)',
                    background: selected ? 'var(--accent)' : 'transparent',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {selected && <Check size={12} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt.name}</div>
                  {fmt.description && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{fmt.description}</div>
                  )}
                </div>
              </button>
            )
          })}
          {!allFormats.length && (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', textAlign: 'center', padding: 16 }}>
              暂无可用的图片类格式
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid var(--line)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={onSave}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
            }}
          >
            确认（{selection.length}/{ACTIVE_LIMIT}）
          </button>
        </div>
      </div>
    </div>
  )
}
