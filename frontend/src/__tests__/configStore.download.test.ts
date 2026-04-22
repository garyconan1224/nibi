/**
 * configStore · downloadConfig slice 单测(M3 §3.3 第 3 批)。
 *
 * 覆盖:
 *  ① 初始默认值与后端 `DownloadConfig` 数据类 defaults 一一对齐(camelCase);
 *  ② loadDownloadConfig 成功:GET 返回 wire(snake_case) → store 镜像(camelCase);
 *  ③ saveDownloadConfig 成功:patch omit 未变更字段、POST 下发 snake_case、返回体回写;
 *  ④ 数值越界 POST 422:saveDownloadConfig reject,store 保持原样(即"保留本地 draft")。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/services/client', () => ({
  http: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import { useConfigStore } from '@/store/configStore'

// 后端 wire 默认快照(对齐 shared/settings_store.DownloadConfig defaults)
const WIRE_DEFAULTS = {
  output_dir: '',
  filename_template: '%(title)s-%(id)s.%(ext)s',
  http_proxy: '',
  po_token: '',
  visitor_data: '',
  cookie_base_dirs: [] as string[],
  concurrency_limit: 2,
  retry_count: 3,
  socket_timeout: 30,
}

describe('configStore · downloadConfig slice', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    useConfigStore.getState().resetConfig()
  })

  it('① 初始默认值与后端 DownloadConfig defaults 对齐', () => {
    const dl = useConfigStore.getState().downloadConfig
    expect(dl).toEqual({
      outputDir: '',
      filenameTemplate: '%(title)s-%(id)s.%(ext)s',
      httpProxy: '',
      poToken: '',
      visitorData: '',
      cookieBaseDirs: [],
      concurrencyLimit: 2,
      retryCount: 3,
      socketTimeout: 30,
    })
  })

  it('② loadDownloadConfig 成功:GET 返回 wire → store 镜像(camelCase)', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ...WIRE_DEFAULTS,
        output_dir: '/Users/alice/videos',
        filename_template: '%(uploader)s/%(title)s.%(ext)s',
        http_proxy: 'http://127.0.0.1:7890',
        po_token: 'po-xyz',
        visitor_data: 'vd-abc',
        cookie_base_dirs: ['/opt/cookies', '/data/cookies'],
        concurrency_limit: 4,
        retry_count: 5,
        socket_timeout: 60,
      },
    })

    const returned = await useConfigStore.getState().loadDownloadConfig()

    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock.mock.calls[0][0]).toBe('/download_config')

    const expected = {
      outputDir: '/Users/alice/videos',
      filenameTemplate: '%(uploader)s/%(title)s.%(ext)s',
      httpProxy: 'http://127.0.0.1:7890',
      poToken: 'po-xyz',
      visitorData: 'vd-abc',
      cookieBaseDirs: ['/opt/cookies', '/data/cookies'],
      concurrencyLimit: 4,
      retryCount: 5,
      socketTimeout: 60,
    }
    expect(returned).toEqual(expected)
    expect(useConfigStore.getState().downloadConfig).toEqual(expected)
  })

  it('③ saveDownloadConfig 成功:patch omit 未变更字段 + POST snake_case + 回写', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ...WIRE_DEFAULTS,
        retry_count: 7,
        socket_timeout: 45,
      },
    })

    const next = await useConfigStore.getState().saveDownloadConfig({
      retryCount: 7,
      socketTimeout: 45,
    })

    // POST 下发 snake_case 且仅包含变更字段(output_dir / http_proxy 等未传)
    expect(postMock).toHaveBeenCalledTimes(1)
    const [url, payload] = postMock.mock.calls[0]
    expect(url).toBe('/download_config')
    expect(payload).toEqual({ retry_count: 7, socket_timeout: 45 })
    expect(payload).not.toHaveProperty('output_dir')
    expect(payload).not.toHaveProperty('filename_template')

    // 返回体回写到 store
    expect(next.retryCount).toBe(7)
    expect(next.socketTimeout).toBe(45)
    expect(useConfigStore.getState().downloadConfig.retryCount).toBe(7)
    expect(useConfigStore.getState().downloadConfig.socketTimeout).toBe(45)
  })

  it('④ 数值越界 POST 422:saveDownloadConfig reject,store 保持原样', async () => {
    // 先把 store 推到一个"已编辑本地 draft"的状态
    useConfigStore.getState().setDownloadConfig({ retryCount: 5, concurrencyLimit: 3 })
    const before = useConfigStore.getState().downloadConfig

    // 模拟后端 422:axios 行为下 http.post 会 reject
    postMock.mockRejectedValueOnce(
      Object.assign(new Error('Unprocessable Entity'), { response: { status: 422 } }),
    )

    await expect(
      useConfigStore.getState().saveDownloadConfig({ retryCount: 999 }),
    ).rejects.toThrow(/Unprocessable Entity/)

    // store 保持原样,不被 partially 覆盖,满足"保留本地 draft"契约
    expect(useConfigStore.getState().downloadConfig).toEqual(before)
    expect(useConfigStore.getState().downloadConfig.retryCount).toBe(5)
  })
})

