/* TextDetail — 文字详情页 · 左侧原文 + 右侧分析结果 · 改写/翻译并排对照 (§9.5) */

/* ── Mock text analysis data ── */
const TEXT_DATA = {
  title:    '三明治拍摄脚本参考',
  source:   'uploads/script_draft.md',
  wordCount: 1842,
  readTime:  '约 6 分钟',
  lang:     '中文',
  original: `# 三明治创意短视频脚本

## 开场（0:00–0:08）

画面：清晨厨房，逆光，手持镜头缓慢推进。
旁白：「每一天的开始，都值得用心对待。」

---

## 食材展示（0:08–0:30）

画面：高速摄影——食材逐一落入砧板，水珠四溅。
旁白：「新鲜的生菜、熟成的牛油果、烟熏三文鱼……」

配乐：节奏明快的 lo-fi，BPM 约 95。

---

## 制作过程（0:30–1:10）

镜头 A：特写，切片动作，刀落砧板的声音同步剪辑点。
镜头 B：45° 俯拍，食材层叠过程，每层停顿 0.5 秒。
镜头 C：侧光特写，奶酪拉丝，慢动作 240fps。

旁白：「三层，刚好。」

---

## 品尝与收尾（1:10–1:30）

画面：主持人端起三明治，阳光照射，轻咬一口，满足表情特写。
旁白：「今天也是元气满满的一天。」
配乐渐淡，字幕：品牌 Logo + 官网。

---

## 分镜备注

- 整体色调：暖白 + 自然光，避免过曝
- 剪辑节奏：0–30s 慢，30s–1:10 快切，收尾放缓
- 音效：食材声音保留，旁白干净无混响`,
  analysis: {
    abstract: '这是一份面向社交媒体的食物短视频创意脚本，总时长约 1 分 30 秒，结构清晰分为四段：开场氛围建立、食材展示、制作过程、品尝收尾。整体风格温暖治愈，适合小红书与 Instagram 发布。',
    keyPoints: [
      '四段式结构，节奏由慢到快再收缓',
      '强调视觉与听觉双通道设计（声音同步剪辑点）',
      '慢动作（240fps）用于奶酪拉丝高光时刻',
      '配乐建议 lo-fi 风格 BPM 95，与节奏匹配',
      '最终画面需要品牌 Logo 的植入',
    ],
    quotes: [
      '「每一天的开始，都值得用心对待。」',
      '「三层，刚好。」',
      '「今天也是元气满满的一天。」',
    ],
    inference: {
      usage:    '品牌内容营销 / 社交媒体短视频 / 平台：小红书 · Instagram · 抖音',
      audience: '25–35 岁城市女性，注重生活品质，有轻食健康偏好',
      intent:   '传递品牌「精致日常」调性，通过食物场景引发情感共鸣',
    },
  },
  rewrite: {
    formal: `# 食品品牌宣传短视频创意方案

## 一、开场段落（时间节点：00:00–00:08）

采用清晨厨房场景，以逆光自然光为主要照明来源，运镜方式为缓推镜头，营造宁静、精致的氛围基调。
旁白文案：「每一天的开始，都值得用心对待。」

## 二、食材展示段落（时间节点：00:08–00:30）

运用高速摄影技术记录食材入砧板的瞬间动态，通过水珠飞溅的视觉冲击力，强化食材新鲜度认知。
旁白文案介绍主要食材：生菜、牛油果、烟熏三文鱼。
建议配乐选用节奏明快的 Lo-Fi 风格，BPM 约 95 拍。`,
    casual: `# 做个三明治，一天元气开始了🥪

## 开场（0–8秒）

早上厨房，阳光打进来那种感觉。镜头慢慢推进去。
旁白说：「每一天，都值得用心。」

## 食材来了（8–30秒）

哗！食材一个个掉下来，水珠都拍出来了，超好看的。
新鲜生菜、牛油果、烟熏三文鱼……光念出来就饿了。
背景音乐：节奏感强的 lo-fi，大概 95 BPM。`,
  },
  translation: {
    en: `# Creative Script: Sandwich Short Video

## Opening (0:00–0:08)

Visual: Morning kitchen, backlit, slow push-in with handheld camera.
VO: "Every morning deserves a little intention."

---

## Ingredient Showcase (0:08–0:30)

Visual: High-speed footage — ingredients dropping onto the cutting board, water droplets splashing.
VO: "Fresh lettuce, ripe avocado, smoked salmon..."

Music: Upbeat lo-fi, ~95 BPM.`,
  },
};

/* ── Markdown renderer (reuse renderMD from results.jsx pattern) ── */
const renderTextMD = (md) => {
  if (!md) return null;
  const lines = md.trim().split('\n');
  const out = []; let ul = null;
  const flush = () => { if (ul) { out.push(<ul key={`u${out.length}`} style={{ paddingLeft: 18, margin: '4px 0 8px' }}>{ul}</ul>); ul = null; } };
  const inl = (s) => {
    const parts = []; let rest = s, k = 0;
    while (rest) {
      const m = rest.match(/\*\*([^*]+)\*\*|`([^`]+)`|_([^_]+)_/);
      if (!m) { parts.push(rest); break; }
      if (m.index) parts.push(rest.slice(0, m.index));
      if (m[1]) parts.push(<strong key={k++}>{m[1]}</strong>);
      if (m[2]) parts.push(<code key={k++} style={{ fontFamily: 'var(--mono)', fontSize: '0.88em', background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 4 }}>{m[2]}</code>);
      if (m[3]) parts.push(<em key={k++}>{m[3]}</em>);
      rest = rest.slice(m.index + m[0].length);
    }
    return parts;
  };
  lines.forEach((raw, i) => {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); out.push(<div key={`sp${i}`} style={{ height: 8 }}/>); return; }
    if (l === '---') { flush(); out.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '10px 0' }}/>); return; }
    if (l.startsWith('### ')) { flush(); out.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 6px', color: 'var(--ink)' }}>{l.slice(4)}</h3>); return; }
    if (l.startsWith('## '))  { flush(); out.push(<h2 key={i} style={{ fontSize: 16, fontWeight: 700, margin: '18px 0 8px', color: 'var(--ink)' }}>{l.slice(3)}</h2>); return; }
    if (l.startsWith('# '))   { flush(); out.push(<h1 key={i} style={{ fontFamily: 'var(--display)', fontSize: 22, margin: '0 0 14px', lineHeight: 1.2 }}>{l.slice(2)}</h1>); return; }
    if (l.startsWith('> '))   { flush(); out.push(<blockquote key={i} style={{ margin: '4px 0', padding: '8px 12px', borderLeft: '3px solid var(--accent)', background: 'var(--bg-sunken)', borderRadius: '0 8px 8px 0', fontSize: 13, color: 'var(--ink-2)' }}>{inl(l.slice(2))}</blockquote>); return; }
    if (/^[-*] /.test(l.trim())) { if (!ul) ul = []; ul.push(<li key={`li${i}`} style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink-2)', marginBottom: 3 }}>{inl(l.trim().slice(2))}</li>); return; }
    flush();
    out.push(<p key={i} style={{ fontSize: 13, lineHeight: 1.72, color: 'var(--ink-2)', margin: '4px 0' }}>{inl(l)}</p>);
  });
  flush();
  return out;
};

/* ═══════════════════════════════════════════
   TextDetail
   ═══════════════════════════════════════════ */
const TextDetail = ({ material, onBack }) => {
  const [activeTab,    setActiveTab]    = React.useState('analysis');
  const [rewriteStyle, setRewriteStyle] = React.useState('formal');
  const [showTranslate, setShowTranslate] = React.useState(false);
  const [summaryLen,   setSummaryLen]   = React.useState('standard'); // minimal | standard | detailed
  const [copiedItem,   setCopiedItem]   = React.useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedItem(key);
    setTimeout(() => setCopiedItem(null), 1800);
  };

  const tabs = [
    { id: 'analysis',  label: '摘要 · 要点 · 金句', icon: IcDoc },
    { id: 'inference', label: '联想归纳',             icon: IcSpark },
    { id: 'rewrite',   label: '改写 · 翻译',         icon: IcEdit },
  ];

  const abstractByLen = {
    minimal:  TEXT_DATA.analysis.abstract.slice(0, 60) + '……',
    standard: TEXT_DATA.analysis.abstract,
    detailed: TEXT_DATA.analysis.abstract + '脚本结构可直接用于分镜拍摄，建议配合 AI 提示词工具做画面描述的补充。',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'hidden' }}>

      {/* ════════ LEFT: Original text ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    borderRight: '1px solid var(--line)' }}>

        {/* Nav bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                      borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-elev)' }}>
          <button className="btn btn-ghost" onClick={onBack}
                  style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcArrowRight size={13} style={{ transform: 'rotate(180deg)' }}/> 任务中心
          </button>
          <span style={{ width: 1, height: 16, background: 'var(--line)' }}/>
          <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {material?.title || TEXT_DATA.title}
          </span>
          <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>TEXT · {TEXT_DATA.wordCount} 字</span>
        </div>

        {/* Phase 3C — 7 维度标签 */}
        <div className="it-host" style={{ padding:'12px 22px 0', flexShrink:0, background:'var(--bg-elev)' }}>
          <ItemTagsPanel itemId={material?.id || 'm7'} compact/>
        </div>

        {/* Source meta */}
        <div style={{ display: 'flex', gap: 16, padding: '10px 22px', borderBottom: '1px solid var(--line)',
                      flexShrink: 0, background: 'var(--bg-sunken)' }}>
          {[
            ['来源', TEXT_DATA.source],
            ['字数', `${TEXT_DATA.wordCount} 字`],
            ['阅读时长', TEXT_DATA.readTime],
            ['语言', TEXT_DATA.lang],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--mono)', fontSize: 10 }}>{k}</span>
              <span style={{ color: 'var(--ink-2)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Original text scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {renderTextMD(TEXT_DATA.original)}
        </div>
      </div>

      {/* ════════ RIGHT: Analysis panel ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, padding: '0 16px', borderBottom: '1px solid var(--line)',
                      flexShrink: 0, background: 'var(--bg-elev)', paddingTop: 8 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                             borderRadius: '8px 8px 0 0', fontSize: 12, fontWeight: 500,
                             border: 'none', cursor: 'pointer',
                             background: activeTab === tab.id ? 'var(--bg)' : 'transparent',
                             color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-3)',
                             borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent' }}>
              <tab.icon size={13}/>{tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

          {/* ─ Analysis tab ─ */}
          {activeTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary length toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="eyebrow">摘要长度</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[['minimal','极简 50字'],['standard','标准 100字'],['detailed','详细 200字']].map(([k,l]) => (
                    <button key={k} onClick={() => setSummaryLen(k)}
                            style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                     border: 'none', cursor: 'pointer',
                                     background: summaryLen === k ? 'var(--ink)' : 'var(--bg-sunken)',
                                     color: summaryLen === k ? 'var(--bg)' : 'var(--ink-3)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Abstract */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="eyebrow">摘要</span>
                  <button onClick={() => handleCopy(abstractByLen[summaryLen], 'abstract')}
                          style={{ height: 24, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                   border: 'none', cursor: 'pointer', background: 'var(--bg-sunken)',
                                   color: copiedItem === 'abstract' ? 'var(--accent-green)' : 'var(--ink-3)',
                                   display: 'flex', alignItems: 'center', gap: 5 }}>
                    {copiedItem === 'abstract' ? <IcCheck size={11}/> : <IcDownload size={11}/>}
                    {copiedItem === 'abstract' ? '已复制' : '复制'}
                  </button>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ink-2)', margin: 0,
                             padding: '12px 14px', background: 'var(--bg-elev)',
                             border: '1px solid var(--line)', borderRadius: 12 }}>
                  {abstractByLen[summaryLen]}
                </p>
              </div>

              {/* Key points */}
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>要点列表</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {TEXT_DATA.analysis.keyPoints.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 12px',
                                          background: 'var(--bg-elev)', border: '1px solid var(--line)',
                                          borderRadius: 9, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', paddingTop: 2, flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {pt}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quotes */}
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>金句摘录</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {TEXT_DATA.analysis.quotes.map((q, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <blockquote style={{ flex: 1, margin: 0, padding: '10px 14px',
                                           borderLeft: '3px solid var(--accent)', background: 'var(--bg-sunken)',
                                           borderRadius: '0 10px 10px 0', fontSize: 13, lineHeight: 1.65,
                                           color: 'var(--ink)', fontStyle: 'italic' }}>
                        {q}
                      </blockquote>
                      <button onClick={() => handleCopy(q, `q${i}`)}
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line)',
                                       background: 'var(--bg-elev)', cursor: 'pointer', display: 'grid', placeItems: 'center',
                                       color: copiedItem === `q${i}` ? 'var(--accent-green)' : 'var(--ink-3)', flexShrink: 0 }}>
                        {copiedItem === `q${i}` ? <IcCheck size={12}/> : <IcDownload size={12}/>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <button className="btn" style={{ fontSize: 12 }}><IcDownload size={13}/> 导出 .md</button>
                <button className="btn" style={{ fontSize: 12 }}><IcDownload size={13}/> 导出 .docx</button>
              </div>
            </div>
          )}

          {/* ─ Inference tab ─ */}
          {activeTab === 'inference' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>联想归纳 · LLM 深度推导</div>
              {[
                { label: '用途推断',   value: TEXT_DATA.analysis.inference.usage,    icon: IcBolt },
                { label: '目标受众',   value: TEXT_DATA.analysis.inference.audience,  icon: IcEye },
                { label: '设计意图',   value: TEXT_DATA.analysis.inference.intent,    icon: IcWand },
              ].map(({ label, value, icon: Ic }) => (
                <div key={label} style={{ padding: '14px 16px', background: 'var(--bg-elev)',
                                          border: '1px solid var(--line)', borderRadius: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Ic size={14} style={{ color: 'var(--accent)' }}/>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)' }}>{value}</p>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0' }}>
                {['深度解读','观点提炼','趋势判断','行动建议'].map(dir => (
                  <button key={dir} className="btn btn-ghost" style={{ fontSize: 12 }}>{dir}</button>
                ))}
              </div>
            </div>
          )}

          {/* ─ Rewrite / Translate tab ─ */}
          {activeTab === 'rewrite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Style controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="eyebrow">改写风格</span>
                {[['formal','正式'],['casual','口语']].map(([k, l]) => (
                  <button key={k} onClick={() => { setRewriteStyle(k); setShowTranslate(false); }}
                          style={{ height: 28, padding: '0 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                                   border: 'none', cursor: 'pointer',
                                   background: rewriteStyle === k && !showTranslate ? 'var(--ink)' : 'var(--bg-sunken)',
                                   color: rewriteStyle === k && !showTranslate ? 'var(--bg)' : 'var(--ink-3)' }}>
                    {l}
                  </button>
                ))}
                <span style={{ width: 1, height: 18, background: 'var(--line)' }}/>
                <button onClick={() => setShowTranslate(t => !t)}
                        style={{ height: 28, padding: '0 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                                 border: 'none', cursor: 'pointer',
                                 background: showTranslate ? 'var(--accent-3)' : 'var(--bg-sunken)',
                                 color: showTranslate ? '#fff' : 'var(--ink-3)' }}>
                  <IcGlobe size={12}/> 翻译为英文
                </button>
              </div>

              {/* Rewrite output */}
              <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 14px', borderBottom: '1px solid var(--line)',
                              background: 'var(--bg-sunken)' }}>
                  <span className="eyebrow">{showTranslate ? '英文翻译' : `${rewriteStyle === 'formal' ? '正式' : '口语'}风格改写`}</span>
                  <button onClick={() => {
                    const text = showTranslate ? TEXT_DATA.translation.en : TEXT_DATA.rewrite[rewriteStyle];
                    handleCopy(text, 'rewrite');
                  }} style={{ height: 24, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                               border: 'none', cursor: 'pointer', background: 'var(--bg-elev)',
                               color: copiedItem === 'rewrite' ? 'var(--accent-green)' : 'var(--ink-3)',
                               display: 'flex', alignItems: 'center', gap: 5 }}>
                    {copiedItem === 'rewrite' ? <IcCheck size={11}/> : <IcDownload size={11}/>}
                    {copiedItem === 'rewrite' ? '已复制' : '复制'}
                  </button>
                </div>
                <div style={{ padding: '14px 16px', maxHeight: 420, overflowY: 'auto' }}>
                  {renderTextMD(showTranslate ? TEXT_DATA.translation.en : TEXT_DATA.rewrite[rewriteStyle])}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ fontSize: 12 }}><IcDownload size={13}/> 导出 .docx</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }}><IcSpark size={13}/> 重新生成</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

window.TextDetail = TextDetail;
