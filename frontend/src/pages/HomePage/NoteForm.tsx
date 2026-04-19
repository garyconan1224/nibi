import { FC, useState } from 'react'
import { Link2, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPipelineTask } from '@/services/pipeline'
import { useTaskStore } from '@/store/taskStore'

const NoteForm: FC = () => {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addTask, setCurrentTask } = useTaskStore()

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      // 构造请求体：project_id 用随机 UUID，task_type 固定为 create
      const body = {
        project_id: crypto.randomUUID(),
        task_type: 'create',
        payload: { url: trimmed },
      }

      // 调用后端 POST /pipeline/tasks（通过服务层封装）
      const { task_id } = await createPipelineTask(body)

      // 构造初始 TaskRecord 写入 store，等待轮询更新详情
      addTask({
        task_id,
        project_id: body.project_id,
        task_type: body.task_type,
        payload: body.payload,
        status: 'PENDING',
        progress: 0,
        log: [],
        result: {},
        error: '',
        retry_of: '',
        cancel_requested: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // 自动切换到新任务
      setCurrentTask(task_id)

      // 清空输入框
      setUrl('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Link2 className="h-4 w-4 text-primary" />
        <span>新建笔记</span>
      </div>

      {/* URL 输入框 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">视频 URL</label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="粘贴 YouTube / Bilibili 链接..."
          disabled={loading}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* 提交按钮 */}
      <Button
        onClick={handleSubmit}
        disabled={loading || !url.trim()}
        className="w-full"
        size="sm"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>提交中...</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>开始处理</span>
          </>
        )}
      </Button>

      {/* 提示文案 */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        支持 YouTube、Bilibili 等平台链接。提交后将自动下载并生成笔记。
      </p>
    </div>
  )
}

export default NoteForm

