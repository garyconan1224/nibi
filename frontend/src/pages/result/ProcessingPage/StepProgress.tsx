import {
  Download, Search, Subtitles, Image, Eye, BookMarked, Database, Check,
} from 'lucide-react'
import type { TaskStatus } from '@/types/task'
import { PROCESSING_STAGES } from '@/types/task'

const STAGE_ICON_MAP: Record<string, typeof Download> = {
  DOWNLOAD: Download,
  PROBE: Search,
  ASR: Subtitles,
  FRAMES: Image,
  VLM: Eye,
  SUM: BookMarked,
  STORE: Database,
}

// R16.2 各任务类型应跳过的阶段（不显示在步骤流里）
const SKIP_STAGES_BY_TYPE: Record<string, string[]> = {
  audio: ['FRAMES', 'VLM'],
  note: ['PROBE', 'FRAMES', 'VLM', 'ASR'],
}

function visibleStages(taskType: string): typeof PROCESSING_STAGES {
  const skip = new Set(SKIP_STAGES_BY_TYPE[taskType] ?? [])
  return PROCESSING_STAGES.filter((s) => !skip.has(s.id))
}

// R12.3 各阶段简短描述（对齐 design/components/processing.jsx LOGS_BY 旁的 desc）
const STAGE_DESC: Record<string, string> = {
  DOWNLOAD: 'yt-dlp · 平台 dash · 仅链接来源。',
  PROBE:    '识别格式 · 时长 · 字幕轨 · 音轨数。',
  ASR:      'Whisper · 中文 · 带时间戳 SRT。',
  FRAMES:   'PySceneDetect + 采样 → 关键帧。',
  VLM:      '视觉模型逐帧 · OCR · 失败 3 次跳过。',
  SUM:      'LLM 生成章节 · 要点 · 关键词。',
  STORE:    '写入任务数据库 · 索引多维度标签。',
}

interface StepProgressProps {
  currentStatus: string
  progress: number
  taskType: string
  taskLogs: Array<{ ts: string; level: string; message: string }>
}

type StepState = 'queued' | 'running' | 'done'

interface StepWithState {
  id: TaskStatus
  name: string
  icon: typeof Download
  state: StepState
  pct: number
}

export function deriveSteps(currentStatus: string, progress: number, taskType: string): StepWithState[] {
  const stages = visibleStages(taskType)
  const stageIds = stages.map((s) => s.id)
  const currentIdx = stageIds.indexOf(currentStatus as TaskStatus)

  return stages.map((stage) => {
    const stageIdx = stageIds.indexOf(stage.id)
    let state: StepState
    let pct: number

    if (currentIdx < 0) {
      if (currentStatus === 'SUCCESS' && progress >= 1) {
        state = 'done'
        pct = 1
      } else {
        state = 'queued'
        pct = 0
      }
    } else if (stageIdx < currentIdx) {
      state = 'done'
      pct = 1
    } else if (stageIdx === currentIdx) {
      state = 'running'
      pct = progress
    } else {
      state = 'queued'
      pct = 0
    }

    const icon = STAGE_ICON_MAP[stage.id] ?? Download
    return { ...stage, icon, state, pct }
  })
}

function getLogsForStage(
  logs: StepProgressProps['taskLogs'],
  stageId: string,
): Array<{ text: string; kind: string }> {
  // 简单匹配：日志消息中包含阶段关键词
  const keywords: Record<string, string[]> = {
    DOWNLOAD: ['download', 'yt-dlp', '下载'],
    PROBE: ['probe', 'ffprobe', '探测', '格式'],
    ASR: ['whisper', 'asr', '转录', 'transcribe'],
    FRAMES: ['frame', '截帧', 'ffmpeg'],
    VLM: ['vlm', 'vision', '视觉', 'qwen'],
    SUM: ['summar', '总结', 'claude'],
    STORE: ['store', '入库', 'database'],
  }

  const kws = keywords[stageId] ?? []
  // R12.3 三色日志：error→err（粉）/ warning→warn（橙）/ info+成功关键词→ok（绿）/ 其它→默认灰
  const SUCCESS_HINTS = ['成功', 'success', 'ok', 'done', '完成', '✓', '入库']
  return logs
    .filter((l) => {
      const msg = l.message.toLowerCase()
      if (stageId === 'DOWNLOAD' && (msg.includes('下载模型') || msg.includes('模型下载') || msg.includes('whisper 模型'))) {
        return false
      }
      if (stageId === 'PROBE' && msg.includes('尝试策略')) {
        return false
      }
      return kws.some((kw) => msg.includes(kw))
    })
    .map((l) => {
      const lv = (l.level || '').toLowerCase()
      let kind = ''
      if (lv === 'error') kind = 'err'
      else if (lv === 'warning' || lv === 'warn') kind = 'warn'
      else if (SUCCESS_HINTS.some((h) => l.message.toLowerCase().includes(h))) kind = 'ok'
      return { text: l.message, kind }
    })
}

/** R18.1.4: 从 ASR 日志中提取模型下载进度 */
function extractDownloadProgress(
  logs: StepProgressProps['taskLogs'],
): {
  doneMB: number
  totalMB: number
  files: string
  active: boolean
  fileDone?: number
  fileTotal?: number
} | null {
  // 从后往前找最近一条下载进度日志
  for (let i = logs.length - 1; i >= 0; i--) {
    const msg = logs[i].message
    // 格式: "📥 下载模型 | 50/140 MB | 3/5 files"
    const m = msg.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\s*MB\s*\|\s*(\d+\/\d+\s*files)/)
    if (m) {
      return { doneMB: parseFloat(m[1]), totalMB: parseFloat(m[2]), files: m[3], active: true }
    }
    // 格式: "📥 下载模型 | 3/5 files"
    const fm = msg.match(/下载模型\s*\|\s*(\d+)\/(\d+)\s*files/)
    if (fm) {
      const fileDone = parseInt(fm[1], 10)
      const fileTotal = parseInt(fm[2], 10)
      return {
        doneMB: 0,
        totalMB: 0,
        files: `${fileDone}/${fileTotal} files`,
        active: true,
        fileDone,
        fileTotal,
      }
    }
    // 模型已就绪 → 下载完成
    if (msg.includes('模型已就绪') || msg.includes('模型下载完成')) {
      return null // 下载已完成，不再显示
    }
    // 开始下载但尚无进度数据
    if (msg.includes('开始下载模型文件')) {
      return { doneMB: 0, totalMB: 0, files: '...', active: true }
    }
  }
  return null
}

export function StepProgress({ currentStatus, progress, taskType, taskLogs }: StepProgressProps) {
  const steps = deriveSteps(currentStatus, progress, taskType)

  return (
    <div className="step-stream">
      {steps.map((s) => {
        const Icon = s.icon
        const stageLogs = getLogsForStage(taskLogs, s.id)

        return (
          <div key={s.id} className="step-row" data-state={s.state}>
            <div className="ico">
              {s.state === 'done' ? (
                <Check size={20} />
              ) : s.state === 'running' ? (
                <div className="spinner" />
              ) : (
                <Icon size={18} />
              )}
            </div>
            <div className="body">
              <div className="hd">
                {s.name}
                <span className="kbd">{s.id.toLowerCase()}</span>
              </div>
              <div className="desc">{STAGE_DESC[s.id] ?? ''}</div>
              {/* R18.1.4: ASR 模型下载进度条 */}
              {s.id === 'ASR' && s.state === 'running' && (() => {
                const dl = extractDownloadProgress(taskLogs)
                if (!dl) return null
                const pct = dl.totalMB > 0
                  ? Math.min(100, Math.round((dl.doneMB / dl.totalMB) * 100))
                  : dl.fileTotal
                    ? Math.min(100, Math.round(((dl.fileDone ?? 0) / dl.fileTotal) * 100))
                    : 0
                const detail = dl.totalMB > 0
                  ? `${dl.doneMB.toFixed(0)}/${dl.totalMB.toFixed(0)} MB · ${dl.files}`
                  : dl.fileTotal
                    ? dl.files
                    : `准备中... · ${dl.files}`
                return (
                  <div style={{
                    margin: '8px 0',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--surface-2, #f0f4ff)',
                    border: '1px solid var(--border, #d0d8f0)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>📥 下载 ASR 模型</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
                        {detail}
                      </span>
                    </div>
                    <div style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--surface-3, #e0e4ee)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 3,
                        background: 'var(--accent, #4f7df9)',
                        width: `${pct}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })()}
              {stageLogs.length > 0 && (
                <div className="logs">
                  {stageLogs.map((l, j) => (
                    <div key={j} className={`ln ${l.kind}`}>
                      {l.kind === 'warn' && <span style={{ marginRight: 6 }}>⚠</span>}
                      {l.kind === 'err'  && <span style={{ marginRight: 6 }}>✗</span>}
                      {l.kind === 'ok'   && <span style={{ marginRight: 6 }}>✓</span>}
                      {l.text}
                    </div>
                  ))}
                  {s.state === 'running' && <div className="ln">{'▌'}</div>}
                </div>
              )}
            </div>
            <div className="progress">
              <div className="pct">
                {s.state === 'queued'
                  ? '—'
                  : s.state === 'done'
                    ? '✓ DONE'
                    : `${Math.round(s.pct * 100)}%`}
              </div>
              <div className="bar">
                <div className="fill" style={{ width: `${s.pct * 100}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
