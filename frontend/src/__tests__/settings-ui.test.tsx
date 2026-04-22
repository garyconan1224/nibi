import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from '@/components/ui/section'
import { FieldRow } from '@/components/ui/field-row'
import { DirtyDot } from '@/components/ui/dirty-dot'
import { EmptyState } from '@/components/ui/empty-state'

describe('ui/section', () => {
  it('渲染标题 / 描述 / 内容', () => {
    render(
      <Section title="基础信息" description="说明">
        <div data-testid="child">child</div>
      </Section>,
    )
    expect(screen.getByText('基础信息')).toBeTruthy()
    expect(screen.getByText('说明')).toBeTruthy()
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('collapsible=true 时折叠后不渲染 children', () => {
    render(
      <Section title="可折叠" collapsible defaultOpen={false}>
        <div data-testid="hidden">child</div>
      </Section>,
    )
    expect(screen.queryByTestId('hidden')).toBeNull()
  })
})

describe('ui/field-row', () => {
  it('dirty=true 时渲染 dirty-dot', () => {
    render(
      <FieldRow htmlFor="k" label="Key" dirty>
        <input id="k" />
      </FieldRow>,
    )
    expect(document.querySelector('[data-slot="dirty-dot"]')).not.toBeNull()
  })

  it('error 优先于 hint 显示并带 role=alert', () => {
    render(
      <FieldRow htmlFor="k" label="Key" hint="hint text" error="error text">
        <input id="k" />
      </FieldRow>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('error text')
    expect(screen.queryByText('hint text')).toBeNull()
  })

  it('required 时渲染红星', () => {
    render(
      <FieldRow htmlFor="k" label="Key" required>
        <input id="k" />
      </FieldRow>,
    )
    expect(screen.getByText('*')).toBeTruthy()
  })
})

describe('ui/dirty-dot', () => {
  it('默认 tone 使用 primary 色', () => {
    const { container } = render(<DirtyDot />)
    const dot = container.querySelector('[data-slot="dirty-dot"]')
    expect(dot?.className).toContain('bg-violet-500')
  })

  it('tone=danger 使用 rose 色', () => {
    const { container } = render(<DirtyDot tone="danger" />)
    const dot = container.querySelector('[data-slot="dirty-dot"]')
    expect(dot?.className).toContain('bg-rose-500')
  })
})

describe('ui/empty-state', () => {
  it('渲染标题 / 描述 / action 按钮', () => {
    render(
      <EmptyState
        title="暂无数据"
        description="请先添加配置"
        action={<button>新增</button>}
      />,
    )
    expect(screen.getByText('暂无数据')).toBeTruthy()
    expect(screen.getByText('请先添加配置')).toBeTruthy()
    expect(screen.getByRole('button', { name: '新增' })).toBeTruthy()
  })
})

