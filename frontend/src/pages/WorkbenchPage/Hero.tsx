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
        粘贴链接或拖入文件 — VidMirror 自动识别类型并提取创作蓝图。
      </p>
    </section>
  )
}
