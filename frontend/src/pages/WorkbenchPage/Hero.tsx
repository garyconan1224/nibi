interface HeroProps {
  backendUrl?: string
}

export function Hero({ backendUrl = '127.0.0.1:8000' }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-eyebrow">
        <span className="hb-pill">v0.3 BETA</span>
        VidMirror ·{' '}
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{backendUrl}</span>
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: 99,
            background: 'var(--accent-green)',
            display: 'inline-block',
          }}
        />
        本地版 · 无文件大小限制
      </div>

      <h1 className="display">
        把任意内容,变成
        <br />
        <span className="accent-pink">可复刻</span>的
        <span className="accent-purple">创作蓝图</span>。
      </h1>

      <p className="lede">
        粘贴 B站 / YouTube / 小红书 / 抖音链接,或上传本地视频·图片·音频·文字 ——
        VidMirror 自动识别类型,调用 AI 分析并提取画面提示词、字幕、风格参数,归入任务数据库。
      </p>
    </section>
  )
}
