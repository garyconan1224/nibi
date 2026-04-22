import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfigStore } from '@/store/configStore'
import * as downloadService from '@/services/download'

// Mock download service
vi.mock('@/services/download', () => ({
  fetchDownloadConfig: vi.fn(),
  updateDownloadConfig: vi.fn(),
}))

const mockDownloadService = downloadService as any

describe('useConfigStore - Core Config', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useConfigStore.setState((state) => {
      const defaults = {
        defaultQuality: 'medium' as const,
        defaultFormats: ['bulleted', 'summary'] as const[],
        defaultStyle: 'academic' as const,
        screenshot: false,
        link: false,
        video_understanding: false,
        video_interval: 30,
        grid_size: [2, 2] as [number, number],
        extras: '',
        httpProxy: '',
        textProviderId: '',
        textModelId: '',
        visionProviderId: '',
        videoModelId: '',
        transcriber: {
          type: 'fast-whisper' as const,
          whisperModelSize: 'medium' as const,
          language: 'zh',
          device: 'cpu',
          groqApiKey: '',
          initialPrompt: '',
        },
        screenshotSettings: {
          defaultInterval: 6,
          gridSize: [3, 3] as [number, number],
          jpegQuality: 85,
          embedInNote: true,
        },
        downloadMode: 'balanced' as const,
        poToken: '',
        visitorData: '',
        cookieBaseDirs: '',
        downloadConfig: {
          outputDir: '',
          filenameTemplate: '%(title)s-%(id)s.%(ext)s',
          httpProxy: '',
          poToken: '',
          visitorData: '',
          cookieBaseDirs: [],
          concurrencyLimit: 2,
          retryCount: 3,
          socketTimeout: 30,
        },
      }
      return { ...state, ...defaults }
    })
    vi.clearAllMocks()
  })

  it('初始状态：defaultQuality=medium, defaultFormats 包含 bulleted 和 summary', () => {
    const state = useConfigStore.getState()
    expect(state.defaultQuality).toBe('medium')
    expect(state.defaultFormats).toContain('bulleted')
    expect(state.defaultFormats).toContain('summary')
  })

  it('setConfig 可部分更新配置', () => {
    const state = useConfigStore.getState()
    state.setConfig({ defaultQuality: 'fast', screenshot: true })

    const updated = useConfigStore.getState()
    expect(updated.defaultQuality).toBe('fast')
    expect(updated.screenshot).toBe(true)
    expect(updated.link).toBe(false) // 未变更的字段保持原值
  })

  it('resetConfig 重置所有字段为默认值', () => {
    const state = useConfigStore.getState()
    state.setConfig({
      defaultQuality: 'slow',
      screenshot: true,
      httpProxy: 'http://proxy:7890',
    })

    // 验证已修改
    let updated = useConfigStore.getState()
    expect(updated.defaultQuality).toBe('slow')
    expect(updated.screenshot).toBe(true)
    expect(updated.httpProxy).toBe('http://proxy:7890')

    // 执行重置
    updated.resetConfig()

    // 验证已重置
    const reset = useConfigStore.getState()
    expect(reset.defaultQuality).toBe('medium')
    expect(reset.screenshot).toBe(false)
    expect(reset.httpProxy).toBe('')
  })

  it('setDownloadConfig 浅合并 downloadConfig', () => {
    const state = useConfigStore.getState()
    state.setDownloadConfig({
      outputDir: '/custom/path',
      concurrencyLimit: 4,
    })

    const updated = useConfigStore.getState()
    expect(updated.downloadConfig.outputDir).toBe('/custom/path')
    expect(updated.downloadConfig.concurrencyLimit).toBe(4)
    // 其他字段保持原值
    expect(updated.downloadConfig.filenameTemplate).toBe('%(title)s-%(id)s.%(ext)s')
  })
})

describe('useConfigStore - Download Config API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadDownloadConfig 从后端拉取并更新 store', async () => {
    const mockConfig = {
      output_dir: '/downloads',
      filename_template: '%(title)s.%(ext)s',
      http_proxy: '',
      po_token: 'token123',
      visitor_data: '',
      cookie_base_dirs: [],
      concurrency_limit: 3,
      retry_count: 5,
      socket_timeout: 60,
    }
    mockDownloadService.fetchDownloadConfig.mockResolvedValueOnce(mockConfig)

    const state = useConfigStore.getState()
    const result = await state.loadDownloadConfig()

    expect(result.outputDir).toBe('/downloads')
    expect(result.poToken).toBe('token123')
    expect(result.concurrencyLimit).toBe(3)

    const updated = useConfigStore.getState()
    expect(updated.downloadConfig.outputDir).toBe('/downloads')
  })

  it('saveDownloadConfig 上传 patch 到后端并回写 store', async () => {
    const mockResponse = {
      output_dir: '/custom',
      filename_template: '%(title)s-custom.%(ext)s',
      http_proxy: '',
      po_token: '',
      visitor_data: '',
      cookie_base_dirs: [],
      concurrency_limit: 2,
      retry_count: 3,
      socket_timeout: 30,
    }
    mockDownloadService.updateDownloadConfig.mockResolvedValueOnce(mockResponse)

    const state = useConfigStore.getState()
    const result = await state.saveDownloadConfig({
      outputDir: '/custom',
      filenameTemplate: '%(title)s-custom.%(ext)s',
    })

    expect(result.outputDir).toBe('/custom')
    expect(mockDownloadService.updateDownloadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        output_dir: '/custom',
        filename_template: '%(title)s-custom.%(ext)s',
      })
    )
  })

  it('saveDownloadConfig 失败时 store 保持原状', async () => {
    const state = useConfigStore.getState()
    state.setDownloadConfig({ outputDir: '/original' })

    const error = new Error('Backend rejected')
    mockDownloadService.updateDownloadConfig.mockRejectedValueOnce(error)

    try {
      await state.saveDownloadConfig({ outputDir: '/failed' })
    } catch (e) {
      // 调用方处理 error
    }

    const unchanged = useConfigStore.getState()
    expect(unchanged.downloadConfig.outputDir).toBe('/original')
  })
})

