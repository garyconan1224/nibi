"""
笔记生成REST API

提供BiliNote风格的笔记生成接口：
- POST /api/notes/generate - 创建笔记生成任务
- GET /api/notes/tasks/{task_id}/status - 获取任务状态
- GET /api/notes/tasks/{task_id}/events - SSE状态流
- GET /api/notes/tasks/{task_id}/result - 获取生成结果
"""

import uuid
import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# 导入我们的服务
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))

try:
    from note_generator import NoteGenerator, NoteGenerationTask, TaskStatus
except ImportError as e:
    print(f"Import error: {e}")
    # 占位符，避免启动失败
    class NoteGenerator:
        pass
    class NoteGenerationTask:
        pass
    class TaskStatus:
        pass

router = APIRouter(prefix="/api/notes", tags=["notes"])

# 全局任务存储（生产环境应使用数据库）
active_tasks: Dict[str, NoteGenerationTask] = {}
task_results: Dict[str, Dict] = {}
sse_connections: Dict[str, List] = {}

# 全局NoteGenerator实例
note_generator = None

def get_note_generator():
    """获取NoteGenerator实例（延迟初始化）"""
    global note_generator
    if note_generator is None:
        def sse_callback(event_type: str, data: dict):
            """SSE回调：向所有订阅者推送状态"""
            task_id = data.get('task_id')
            if task_id and task_id in sse_connections:
                event_data = json.dumps(data)
                # 将事件加入所有该任务的连接队列
                for connection_queue in sse_connections[task_id]:
                    try:
                        connection_queue.put_nowait(f"data: {event_data}\n\n")
                    except:
                        pass  # 连接可能已断开

        note_generator = NoteGenerator(
            output_base="./data/projects",
            sse_callback=sse_callback
        )
    return note_generator


class NoteGenerateRequest(BaseModel):
    """笔记生成请求"""
    video_url: str = Field(..., description="视频链接")
    project_id: str = Field(default="default", description="项目ID")
    provider_id: str = Field(default="openai_compatible", description="AI提供商ID")
    model_name: str = Field(default="gpt-4", description="模型名称")

    # 生成选项
    style: str = Field(default="academic", description="笔记风格: academic/casual/highlights")
    formats: List[str] = Field(default=["link"], description="格式选项: link/screenshot")
    extras: List[str] = Field(default=[], description="额外选项: web_enrich")
    video_understanding: bool = Field(default=False, description="是否启用视频理解")
    video_interval: int = Field(default=10, description="截图间隔（秒）")


class TaskResponse(BaseModel):
    """任务响应"""
    task_id: str
    status: str
    created_at: str


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str
    progress: Optional[float] = None
    message: str = ""
    error_message: str = ""
    created_at: str
    updated_at: str


class TaskResultResponse(BaseModel):
    """任务结果响应"""
    task_id: str
    success: bool
    markdown_path: Optional[str] = None
    transcript_path: Optional[str] = None
    video_meta: Optional[Dict] = None
    error: Optional[str] = None


@router.post("/generate", response_model=TaskResponse)
async def generate_note(
    request: NoteGenerateRequest,
    background_tasks: BackgroundTasks
):
    """
    创建笔记生成任务

    返回任务ID，客户端可通过task_id查询进度和结果
    """
    # 生成任务ID
    task_id = str(uuid.uuid4())[:8]
    created_at = datetime.now().isoformat()

    # 创建任务对象
    task = NoteGenerationTask(
        task_id=task_id,
        video_url=request.video_url,
        platform="",  # 由下载器工厂自动检测
        provider_id=request.provider_id,
        model_name=request.model_name,
        style=request.style,
        formats=request.formats,
        extras=request.extras,
        video_understanding=request.video_understanding,
        video_interval=request.video_interval
    )

    # 存储任务
    active_tasks[task_id] = task

    # 异步执行生成任务
    background_tasks.add_task(
        run_note_generation_task,
        task,
        request.project_id
    )

    return TaskResponse(
        task_id=task_id,
        status=TaskStatus.PARSING.value,
        created_at=created_at
    )


async def run_note_generation_task(task: NoteGenerationTask, project_id: str):
    """后台运行笔记生成任务"""
    try:
        generator = get_note_generator()
        result = await generator.generate_note(task, project_id)

        # 存储结果
        task_results[task.task_id] = result

    except Exception as e:
        # 存储错误结果
        task_results[task.task_id] = {
            "success": False,
            "task_id": task.task_id,
            "error": str(e)
        }
    finally:
        # 清理活跃任务
        if task.task_id in active_tasks:
            del active_tasks[task.task_id]


@router.get("/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """获取任务状态"""

    # 检查是否在活跃任务中
    if task_id in active_tasks:
        task = active_tasks[task_id]
        return TaskStatusResponse(
            task_id=task_id,
            status=task.status.value,
            progress=task.progress,
            message="任务进行中",
            error_message=task.error_message,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )

    # 检查是否在结果中
    if task_id in task_results:
        result = task_results[task_id]
        status = TaskStatus.SUCCESS.value if result.get("success") else TaskStatus.ERROR.value

        return TaskStatusResponse(
            task_id=task_id,
            status=status,
            progress=1.0 if result.get("success") else None,
            message="任务已完成" if result.get("success") else "任务失败",
            error_message=result.get("error", ""),
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )

    # 任务不存在
    raise HTTPException(status_code=404, detail="任务不存在")


@router.get("/tasks/{task_id}/result", response_model=TaskResultResponse)
async def get_task_result(task_id: str):
    """获取任务结果"""

    if task_id in task_results:
        result = task_results[task_id]
        return TaskResultResponse(**result)

    # 检查是否仍在处理中
    if task_id in active_tasks:
        raise HTTPException(status_code=202, detail="任务仍在处理中")

    # 任务不存在
    raise HTTPException(status_code=404, detail="任务不存在")


@router.get("/tasks/{task_id}/events")
async def get_task_events(task_id: str):
    """
    SSE事件流 - 实时获取任务状态更新

    客户端使用EventSource连接此端点获取实时状态
    """
    import asyncio
    import queue

    # 为此连接创建事件队列
    event_queue = queue.Queue()

    # 注册到SSE连接池
    if task_id not in sse_connections:
        sse_connections[task_id] = []
    sse_connections[task_id].append(event_queue)

    async def event_stream():
        try:
            # 首先发送当前状态
            if task_id in active_tasks:
                task = active_tasks[task_id]
                initial_data = {
                    "task_id": task_id,
                    "status": task.status.value,
                    "progress": task.progress,
                    "message": "连接成功，任务进行中"
                }
                yield f"data: {json.dumps(initial_data)}\n\n"

            elif task_id in task_results:
                result = task_results[task_id]
                status = TaskStatus.SUCCESS.value if result.get("success") else TaskStatus.ERROR.value
                initial_data = {
                    "task_id": task_id,
                    "status": status,
                    "progress": 1.0 if result.get("success") else None,
                    "message": "任务已完成" if result.get("success") else f"任务失败: {result.get('error', '')}"
                }
                yield f"data: {json.dumps(initial_data)}\n\n"
                return  # 已完成的任务直接返回

            else:
                # 任务不存在
                error_data = {
                    "task_id": task_id,
                    "status": "ERROR",
                    "message": "任务不存在"
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                return

            # 持续监听事件队列
            while True:
                try:
                    # 非阻塞获取事件（超时1秒）
                    event_data = event_queue.get(timeout=1.0)
                    yield event_data

                    # 检查任务是否完成
                    if task_id in task_results:
                        break

                except queue.Empty:
                    # 发送心跳保持连接
                    yield "data: {\"type\":\"heartbeat\"}\n\n"
                    continue
                except:
                    break

        except asyncio.CancelledError:
            pass
        except Exception as e:
            error_data = {
                "task_id": task_id,
                "status": "ERROR",
                "message": f"SSE连接错误: {e}"
            }
            yield f"data: {json.dumps(error_data)}\n\n"
        finally:
            # 清理连接
            if task_id in sse_connections and event_queue in sse_connections[task_id]:
                sse_connections[task_id].remove(event_queue)
                if not sse_connections[task_id]:
                    del sse_connections[task_id]

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )