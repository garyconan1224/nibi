import {
  Download, Search, Subtitles, Image, Eye, BookMarked, Database, Check,
} from 'lucide-react'
import type { TaskStatus } from '@/types/task'
import { PROCESSING_STAGES } from '@/types/task'

const STAGE_ICONS = [Download, Search, Subtitles, Image, Eye, BookMarked, Database]

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

function deriveSteps(currentStatus: string, progress: number): StepWithState[] {
  const statusOrder = PROCESSING_STAGES.map((s) => s.id)
  const currentIdx = statusOrder.indexOf(currentStatus as TaskStatus)

  return PROCESSING_STAGES.map((stage, i) => {
    const stageIdx = statusOrder.indexOf(stage.id)
    let state: StepState
    let pct: number

    if (currentIdx < 0) {
      // 终结态或未知：根据 progress 判断
      if (progress >= 1) {
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

    return { ...stage, icon: STAGE_ICONS[i], state, pct }
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
    .filter((l) => kws.some((kw) => l.message.toLowerCase().includes(kw)))
    .map((l) => {
      const lv = (l.level || '').toLowerCase()
      let kind = ''
      if (lv === 'error') kind = 'err'
      else if (lv === 'warning' || lv === 'warn') kind = 'warn'
      else if (SUCCESS_HINTS.some((h) => l.message.toLowerCase().includes(h))) kind = 'ok'
      return { text: l.message, kind }
    })
}

export function StepProgress({ currentStatus, progress, taskLogs }: StepProgressProps) {
  const steps = deriveSteps(currentStatus, progress)

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
