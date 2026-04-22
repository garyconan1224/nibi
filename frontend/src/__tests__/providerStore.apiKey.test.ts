import { beforeEach, describe, expect, it, vi } from 'vitest'

// 关键：mock '@/services/client'，避免真实网络；捕获 put payload 做断言
const putMock = vi.fn()
const postMock = vi.fn()
const getMock = vi.fn()

vi.mock('@/services/client', () => ({
  http: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import { useProviderStore } from '@/store/providerStore'

describe('providerStore · api_key 脱敏与 omit 策略（DESIGN_NOTES §3.4 D10）', () => {
  beforeEach(() => {
    putMock.mockReset()
    postMock.mockReset()
    getMock.mockReset()
    useProviderStore.setState({
      providers: [
        {
          id: 'openai_compatible-seed',
          name: 'Seed',
          kind: 'openai_compatible',
          base_url: 'https://api.example.com/v1',
          enabled: true,
          has_api_key: true,
        },
      ],
      providerModels: {},
      modelsLoading: {},
      loading: false,
      error: null,
    })
  })

  it('updateProvider: api_key === "" 时应 omit，不下发给后端', async () => {
    putMock.mockResolvedValueOnce({
      data: { id: 'openai_compatible-seed', enabled: false, has_api_key: true },
    })

    await useProviderStore.getState().updateProvider('openai_compatible-seed', {
      api_key: '',
      enabled: false,
    })

    expect(putMock).toHaveBeenCalledTimes(1)
    const [url, payload] = putMock.mock.calls[0]
    expect(url).toBe('/providers/openai_compatible-seed')
    expect(payload).not.toHaveProperty('api_key')
    expect(payload).toEqual({ enabled: false })
  })

  it('updateProvider: 非空 api_key 应原样透传', async () => {
    putMock.mockResolvedValueOnce({
      data: { id: 'openai_compatible-seed', has_api_key: true },
    })

    await useProviderStore.getState().updateProvider('openai_compatible-seed', {
      api_key: 'sk-rotated',
    })

    const [, payload] = putMock.mock.calls[0]
    expect(payload).toEqual({ api_key: 'sk-rotated' })
  })

  it('updateProvider: 未传 api_key 时 payload 不含该字段', async () => {
    putMock.mockResolvedValueOnce({ data: { id: 'openai_compatible-seed' } })

    await useProviderStore.getState().updateProvider('openai_compatible-seed', {
      base_url: 'https://new.test/v1',
    })
    const [, payload] = putMock.mock.calls[0]
    expect(payload).toEqual({ base_url: 'https://new.test/v1' })
  })

  it('addProvider: 存储 has_api_key 布尔标志（不泄漏明文）', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        id: 'openai_compatible-new',
        name: 'NewCo',
        kind: 'openai_compatible',
        base_url: 'https://new.test/v1',
        enabled: true,
        has_api_key: true,
      },
    })

    const item = await useProviderStore.getState().addProvider({
      name: 'NewCo',
      kind: 'openai_compatible',
      api_key: 'sk-secret',
      base_url: 'https://new.test/v1',
    })

    expect(item.has_api_key).toBe(true)
    // @ts-expect-error —— 编译期保障 ProviderItem 不含 api_key 字段
    expect(item.api_key).toBeUndefined()

    const stored = useProviderStore.getState().providers.find(p => p.id === item.id)
    expect(stored?.has_api_key).toBe(true)
  })

  it('updateProvider: 后端回包 has_api_key 更新到本地 store', async () => {
    putMock.mockResolvedValueOnce({
      data: { id: 'openai_compatible-seed', has_api_key: false },
    })
    await useProviderStore.getState().updateProvider('openai_compatible-seed', {
      api_key: 'sk-rotated',
    })
    const stored = useProviderStore
      .getState()
      .providers.find(p => p.id === 'openai_compatible-seed')
    expect(stored?.has_api_key).toBe(false)
  })
})

