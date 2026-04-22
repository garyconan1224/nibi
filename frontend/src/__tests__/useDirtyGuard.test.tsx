import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { useDirtyGuard } from '@/hooks/useDirtyGuard'

function wrapper({ children }: { children: ReactNode }) {
  // useBlocker 仅在 Data Router 中可用；此处构造最小 createMemoryRouter 实例，
  // 单一路由渲染 children，blocker 能够返回 unblocked 状态但不干扰断言。
  const router = createMemoryRouter(
    [{ path: '/', element: <>{children}</> }],
    { initialEntries: ['/'] },
  )
  return <RouterProvider router={router} />
}

describe('useDirtyGuard', () => {
  it('初始态 current === initial 时不脏', () => {
    const initial = { name: 'A', count: 1 }
    const { result } = renderHook(
      () => useDirtyGuard({ initial, current: initial }),
      { wrapper },
    )
    expect(result.current.isDirty).toBe(false)
    expect(result.current.dirtyCount).toBe(0)
    expect(result.current.dirtyMap.name).toBe(false)
  })

  it('current 变更字段被精确标记', () => {
    const initial = { name: 'A', count: 1, nested: { x: 1 } }
    const { result, rerender } = renderHook(
      ({ current }: { current: typeof initial }) =>
        useDirtyGuard({ initial, current }),
      {
        wrapper,
        initialProps: { current: initial },
      },
    )

    rerender({ current: { ...initial, name: 'B' } })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.dirtyCount).toBe(1)
    expect(result.current.dirtyMap.name).toBe(true)
    expect(result.current.dirtyMap.count).toBe(false)

    // 嵌套对象 JSON 深比较
    rerender({ current: { ...initial, name: 'B', nested: { x: 2 } } })
    expect(result.current.dirtyCount).toBe(2)
    expect(result.current.dirtyMap.nested).toBe(true)
  })

  it('commit(next) 后以 next 作为新基线，isDirty 重置', () => {
    const initial = { name: 'A' }
    const changed = { name: 'B' }
    const { result, rerender } = renderHook(
      ({ current }: { current: typeof initial }) =>
        useDirtyGuard({ initial, current }),
      { wrapper, initialProps: { current: initial } },
    )

    rerender({ current: changed })
    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.commit(changed)
    })
    // 基线更新后，同值不再脏
    rerender({ current: changed })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.dirtyCount).toBe(0)
  })

  it('enabled=false 时强制返回 isDirty=false', () => {
    const initial = { name: 'A' }
    const { result } = renderHook(
      () => useDirtyGuard({ initial, current: { name: 'B' }, enabled: false }),
      { wrapper },
    )
    expect(result.current.isDirty).toBe(false)
    // dirtyMap 仍反映差异，便于上游展示"有变更但不阻止离开"
    expect(result.current.dirtyMap.name).toBe(true)
  })
})

