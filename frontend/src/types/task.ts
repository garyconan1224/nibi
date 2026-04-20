// 任务状态枚举（与后端 TaskStatus 对应）
export enum TaskStatus {
  PENDING = 'PENDING',
  PARSING = 'PARSING',
  DOWNLOADING = 'DOWNLOADING',
  TRANSCRIBING = 'TRANSCRIBING',
  ANALYZING = 'ANALYZING',      // nibi 特有：视觉分析
  SUMMARIZING = 'SUMMARIZING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// 任务日志条目
export interface TaskLogEntry {
  ts: string                           // ISO 时间戳
  level: 'info' | 'warning' | 'error'
  message: string
}

// 任务记录（对应后端 TaskRecord）
export interface TaskRecord {
  task_id: string
  project_id: string
  task_type: string                    // download|analyze|create|storyboard
  payload: Record<string, any>
  status: string                       // TaskStatus 值
  progress: number                     // 0.0 ~ 1.0
  log: TaskLogEntry[]
  result: Record<string, any>
  error: string
  retry_of: string
  cancel_requested: boolean
  created_at: string                   // ISO 时间戳
  updated_at: string                   // ISO 时间戳
}

// 五阶段处理流程（用于 ProcessingStepper）
export interface ProcessingStage {
  id: TaskStatus
  name: string
  icon: string                         // lucide-react 图标名
}

export const PROCESSING_STAGES: ProcessingStage[] = [
  { id: TaskStatus.PARSING, name: '解析', icon: 'Zap' },
  { id: TaskStatus.DOWNLOADING, name: '下载', icon: 'Download' },
  { id: TaskStatus.TRANSCRIBING, name: '转录', icon: 'Subtitles' },
  { id: TaskStatus.ANALYZING, name: '分析', icon: 'Eye' },
  { id: TaskStatus.SUMMARIZING, name: '总结', icon: 'BookMarked' },
]

// 任务列表查询响应
export interface TaskListResponse {
  data: TaskRecord[]
}

/** analyze 任务 payload（与后端 pipeline analyze handler 对齐） */
export interface AnalyzePayload {
  url: string
  model_name: string
  provider_id: string
  quality: 'fast' | 'medium' | 'slow'
  format: string[]
  style: 'academic' | 'minimalist' | 'creative'
  screenshot: boolean
  link: boolean
  video_understanding: boolean
  video_interval: number
  grid_size: [number, number]
  extras?: string
  browser?: string
  proxy?: string
  format_selector?: string
  cookie_base_dirs?: string[]
}

/** download 任务 payload */
export interface DownloadPayload {
  url: string
  browser?: string
  proxy?: string
  po_token?: string
  visitor_data?: string
  format_selector?: string
  cookie_base_dirs?: string[]
}

// 任务创建请求
export interface TaskCreateRequest {
  project_id: string
  task_type: 'download' | 'analyze' | 'create' | 'storyboard'
  payload: AnalyzePayload | DownloadPayload | Record<string, unknown>
}

// 任务创建响应
export interface TaskCreateResponse {
  status: string
  task_id: string
}

// 终结状态集合
export const TERMINAL_STATUSES = new Set([
  TaskStatus.SUCCESS,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED,
])

// 判断任务是否已完成
export const isTaskTerminal = (status: string): boolean => {
  return TERMINAL_STATUSES.has(status as TaskStatus)
}

// 获取状态显示文本
export const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    [TaskStatus.PENDING]: '待处理',
    [TaskStatus.PARSING]: '解析中',
    [TaskStatus.DOWNLOADING]: '下载中',
    [TaskStatus.TRANSCRIBING]: '转录中',
    [TaskStatus.ANALYZING]: '分析中',
    [TaskStatus.SUMMARIZING]: '总结中',
    [TaskStatus.SUCCESS]: '成功',
    [TaskStatus.FAILED]: '失败',
    [TaskStatus.CANCELLED]: '已取消',
  }
  return statusMap[status] || status
}

// 获取状态颜色（用于 UI）
export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    [TaskStatus.PENDING]: 'bg-gray-100 text-gray-700',
    [TaskStatus.PARSING]: 'bg-blue-100 text-blue-700',
    [TaskStatus.DOWNLOADING]: 'bg-cyan-100 text-cyan-700',
    [TaskStatus.TRANSCRIBING]: 'bg-purple-100 text-purple-700',
    [TaskStatus.ANALYZING]: 'bg-orange-100 text-orange-700',
    [TaskStatus.SUMMARIZING]: 'bg-green-100 text-green-700',
    [TaskStatus.SUCCESS]: 'bg-emerald-100 text-emerald-700',
    [TaskStatus.FAILED]: 'bg-red-100 text-red-700',
    [TaskStatus.CANCELLED]: 'bg-slate-100 text-slate-700',
  }
  return colorMap[status] || 'bg-gray-100 text-gray-700'
}

