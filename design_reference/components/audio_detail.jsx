/* AudioDetail — 音频详情页 · 波形图 + 字幕滚动 + 音乐分析时间轴 + 右侧总结面板 (§9.4) */

/* ── Mock audio data ── */
const AUDIO_DATA = {
  title:    '背景乐参考 · Lo-Fi · City Pop',
  source:   'uploads/music_ref.mp3',
  duration: '3:41',
  speakers: [
    { id: 'A', name: '说话人 A', color: 'var(--accent)',   initials: 'A' },
    { id: 'B', name: '说话人 B', color: 'var(--accent-2)', initials: 'B' },
    { id: 'C', name: '产品负责人', color: 'var(--accent-3)', initials: 'C' },
  ],
  transcript: [
    { t: '00:00:05', spk: 'A', text: '大家好，今天我们讨论 Q3 的内容策略方向。' },
    { t: '00:00:18', spk: 'B', text: '我觉得首先要明确目标受众，是 B 端还是 C 端。' },
    { t: '00:00:32', spk: 'C', text: '从产品角度看，两个方向都有机会，但资源分配需要取舍。' },
    { t: '00:00:58', spk: 'A', text: '那我们先聚焦 C 端，用内容来建立品牌认知。' },
    { t: '00:01:14', spk: 'B', text: '同意。视频类内容的完播率明显高于图文，建议加大投入。' },
    { t: '00:01:38', spk: 'C', text: '从数据来看，上季度我们的短视频转化率提升了 23%。' },
    { t: '00:02:02', spk: 'A', text: '这很好。那分镜和脚本的审核流程能压缩吗？' },
    { t: '00:02:25', spk: 'B', text: '可以引入 AI 工具辅助初稿，人工只审最终版本。' },
    { t: '00:02:48', spk: 'C', text: '需要配套的提示词库，这块我们还没有系统化。' },
    { t: '00:03:10', spk: 'A', text: '好，待办：建立内容 AI 提示词库，由产品负责人牵头。' },
    { t: '00:03:28', spk: 'B', text: '下次会议同步进展，预计两周后。' },
  ],
  musicSegments: [
    {
      start: '00:00:00', end: '00:01:30',
      style: 'lo-fi hip hop', mood: '轻松 · 专注', bpm: 88,
      instruments: ['acoustic guitar', 'soft piano', 'lo-fi drums'],
      key: 'C major', atmosphere: '温暖 · 沉浸',
      sunoPrompt: 'lo-fi hip hop, acoustic guitar, soft piano, 88 bpm, warm cozy atmosphere, C major, study music',
    },
    {
      start: '00:01:30', end: '00:03:41',
      style: 'city pop', mood: '明亮 · 怀旧', bpm: 104,
      instruments: ['electric guitar', 'synth bass', 'light percussion'],
      key: 'A minor', atmosphere: '城市 · 黄昏',
      sunoPrompt: 'city pop, electric guitar, synth bass, 104 bpm, nostalgic urban sunset, A minor, 80s Japan vibes',
    },
  ],
  summary: {
    abstract: '本次会议围绕 Q3 内容策略展开，核心共识是优先布局 C 端视频内容，并引入 AI 工具提升脚本生产效率。',
    keyPoints: [
      '优先发展 C 端内容，以视频为主要形式',
      '上季度短视频转化率提升 23%，趋势向好',
      'AI 工具辅助初稿，人工审核最终版本',
      '待办：建立内容 AI 提示词库',
    ],
    quotes: [
      '「从数据来看，上季度我们的短视频转化率提升了 23%。」—— 产品负责人',
      '「视频类内容的完播率明显高于图文，建议加大投入。」—— 说话人 B',
    ],
    todos: [
      '建立内容 AI 提示词库（产品负责人牵头）',
      '两周后同步进展',
    ],
  },
};

/* ── Waveform bars (deterministic from seed) ── */
const Waveform = ({ progress = 0.3, height = 52, bars = 80 }) => {
  const heights = React.useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      const v = Math.sin(i * 0.45) * 0.4 + Math.sin(i * 0.15 + 1.2) * 0.35 + Math.sin(i * 0.9 + 0.5) * 0.25;
      return 10 + (v * 0.5 + 0.5) * (height - 14);
    });
  }, [bars, height]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height, cursor: 'pointer', flex: 1 }}>
      {heights.map((h, i) => {
        const passed = i / bars < progress;
        return (
          <div key={i} style={{
            flex: 1, height: `${h}px`, borderRadius: 2,
            background: passed ? 'var(--accent)' : 'var(--line-strong)',
            transition: 'background 200ms',
            opacity: passed ? 1 : 0.5,
          }}/>
        );
      })}
    </div>
  );
};

/* ── Music segment card ── */
const MusicSegCard = ({ seg, index }) => {
  const [copied, setCopied] = React.useState(false);
  const colors = ['var(--accent-2)', 'var(--accent-3)'];
  const col = colors[index % colors.length];

  const handleCopy = () => {
    navigator.clipboard?.writeText(seg.sunoPrompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)',
                  borderRadius: 14, overflow: 'hidden' }}>
      {/* Header stripe */}
      <div style={{ height: 4, background: col }}/>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {seg.start} – {seg.end}
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, color: col }}>{seg.style}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{seg.mood}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, marginBottom: 10 }}>
          {[
            ['BPM', seg.bpm],
            ['调性', seg.key],
            ['氛围', seg.atmosphere],
            ['乐器', seg.instruments.slice(0, 2).join(' · ')],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--mono)', fontSize: 10, flexShrink: 0 }}>{k}</span>
              <span style={{ color: 'var(--ink-2)' }}>{v}</span>
            </div>
          ))}
        </div>
        {/* Suno prompt */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, lineHeight: 1.65, color: 'var(--ink-2)',
                      background: 'var(--bg-elev)', padding: '8px 10px', borderRadius: 8,
                      border: '1px solid var(--line)', marginBottom: 8 }}>
          {seg.sunoPrompt}
        </div>
        <button onClick={handleCopy}
                style={{ height: 28, padding: '0 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                         display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                         border: 'none', background: col, color: '#fff' }}>
          {copied ? <IcCheck size={12}/> : <IcDownload size={12}/>}
          {copied ? '已复制 Suno 提示词' : '复制 Suno 提示词'}
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AudioDetail
   ═══════════════════════════════════════════ */
const AudioDetail = ({ material, onBack }) => {
  const [activeTab,    setActiveTab]    = React.useState('transcript');
  const [activeLine,   setActiveLine]   = React.useState(3);
  const [playProgress, setPlayProgress] = React.useState(0.28);
  const [playing,      setPlaying]      = React.useState(false);
  const trRef = React.useRef(null);

  /* Simulate playback */
  React.useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setPlayProgress(p => {
        if (p >= 1) { setPlaying(false); return 1; }
        return p + 0.003;
      });
    }, 150);
    return () => clearInterval(t);
  }, [playing]);

  /* Sync active line to playProgress */
  React.useEffect(() => {
    const totalSec = 221;
    const currentSec = playProgress * totalSec;
    const idx = AUDIO_DATA.transcript.reduce((best, l, i) => {
      const sec = l.t.split(':').reduce((a, b, j) => a + (j === 0 ? Number(b) * 60 : Number(b)), 0);
      return sec <= currentSec ? i : best;
    }, 0);
    setActiveLine(idx);
  }, [playProgress]);

  /* Auto-scroll transcript */
  React.useEffect(() => {
    const el = trRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]');
    if (active) el.scrollTop = Math.max(0, active.offsetTop - el.clientHeight / 2 + active.clientHeight / 2);
  }, [activeLine]);

  const tabs = [
    { id: 'transcript', label: '转录 + 说话人', icon: IcMic },
    { id: 'music',      label: '音乐分析',       icon: IcMusic },
    { id: 'summary',    label: '总结',            icon: IcDoc },
  ];

  const spkColor = (spk) => {
    const s = AUDIO_DATA.speakers.find(s => s.id === spk);
    return s ? s.color : 'var(--ink-3)';
  };
  const spkName = (spk) => {
    const s = AUDIO_DATA.speakers.find(s => s.id === spk);
    return s ? s.name : spk;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Nav bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                    borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-elev)' }}>
        <button className="btn btn-ghost" onClick={onBack}
                style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <IcArrowRight size={13} style={{ transform: 'rotate(180deg)' }}/> 任务中心
        </button>
        <span style={{ width: 1, height: 16, background: 'var(--line)' }}/>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {material?.title || AUDIO_DATA.title}
        </span>
        <span className="kw mono" style={{ fontSize: 10 }}>AUDIO · {AUDIO_DATA.duration}</span>
        <button className="btn btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
          <IcDownload size={13}/> .srt
        </button>
        <button className="btn btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
          <IcDownload size={13}/> .md
        </button>
      </div>

      {/* ── Waveform player ── */}
      <div style={{ flexShrink: 0, padding: '14px 24px', borderBottom: '1px solid var(--line)',
                    background: 'var(--bg-elev)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Play button */}
          <button onClick={() => setPlaying(p => !p)}
                  style={{ width: 40, height: 40, borderRadius: 99, border: 'none', cursor: 'pointer',
                           background: 'var(--ink)', color: 'var(--bg)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {playing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>
              : <IcPlay size={16}/>}
          </button>

          {/* Waveform */}
          <div onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPlayProgress((e.clientX - rect.left) / rect.width);
          }} style={{ flex: 1 }}>
            <Waveform progress={playProgress} height={48} bars={100}/>
          </div>

          {/* Time display */}
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
            {(() => {
              const sec = Math.round(playProgress * 221);
              const m = Math.floor(sec / 60), s = sec % 60;
              return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} / ${AUDIO_DATA.duration}`;
            })()}
          </div>
        </div>

        {/* Speaker legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          {AUDIO_DATA.speakers.map(spk => (
            <div key={spk.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: spk.color, flexShrink: 0 }}/>
              {spk.name}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 20px 0', borderBottom: '1px solid var(--line)',
                    flexShrink: 0, background: 'var(--bg-elev)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                           borderRadius: '10px 10px 0 0', fontSize: 13, fontWeight: 500,
                           border: 'none', cursor: 'pointer',
                           background: activeTab === tab.id ? 'var(--bg)' : 'transparent',
                           color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-3)',
                           borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent' }}>
            <tab.icon size={14}/>{tab.label}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'grid',
                    gridTemplateColumns: activeTab === 'transcript' ? '1fr 340px' : '1fr' }}>

        {/* ─ Transcript tab ─ */}
        {activeTab === 'transcript' && (
          <>
            {/* Transcript scroll */}
            <div ref={trRef} style={{ overflowY: 'auto', padding: '14px 20px' }}>
              {AUDIO_DATA.transcript.map((l, i) => (
                <div key={i} data-active={i === activeLine}
                     onClick={() => {
                       setActiveLine(i);
                       const sec = l.t.split(':').reduce((a, b, j) => a + (j === 0 ? Number(b) * 60 : Number(b)), 0);
                       setPlayProgress(sec / 221);
                     }}
                     style={{ display: 'grid', gridTemplateColumns: '60px 28px 1fr', gap: 10,
                               padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 4,
                               background: i === activeLine ? 'var(--bg-elev)' : 'transparent',
                               border: `1px solid ${i === activeLine ? 'var(--line)' : 'transparent'}`,
                               transition: 'all 140ms' }}>
                  <span className="mono" style={{ fontSize: 11, color: i === activeLine ? spkColor(l.spk) : 'var(--ink-4)', paddingTop: 2 }}>
                    {l.t.slice(3)}
                  </span>
                  <div style={{ width: 24, height: 24, borderRadius: 99, background: spkColor(l.spk),
                                display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                                color: '#fff', flexShrink: 0 }}>
                    {l.spk}
                  </div>
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: i === activeLine ? 'var(--ink)' : 'var(--ink-2)',
                                  fontWeight: i === activeLine ? 500 : 400 }}>
                    {l.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Speaker summary sidebar */}
            <div style={{ borderLeft: '1px solid var(--line)', padding: '14px 16px', overflowY: 'auto',
                          background: 'var(--bg-elev)' }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>说话人分布</div>
              {AUDIO_DATA.speakers.map(spk => {
                const count = AUDIO_DATA.transcript.filter(l => l.spk === spk.id).length;
                const pct = Math.round(count / AUDIO_DATA.transcript.length * 100);
                return (
                  <div key={spk.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 99, background: spk.color,
                                    display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {spk.id}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{spk.name}</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{count} 段发言</div>
                      </div>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--display)', fontSize: 22 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-sunken)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: spk.color, borderRadius: 4 }}/>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>金句摘录</div>
                {AUDIO_DATA.summary.quotes.map((q, i) => (
                  <blockquote key={i} style={{ margin: '0 0 10px', padding: '8px 12px',
                                               borderLeft: '3px solid var(--accent)', background: 'var(--bg-sunken)',
                                               borderRadius: '0 8px 8px 0', fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                    {q}
                  </blockquote>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─ Music analysis tab ─ */}
        {activeTab === 'music' && (
          <div style={{ overflowY: 'auto', padding: '20px 24px' }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>音乐片段分析 · {AUDIO_DATA.musicSegments.length} 段</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {AUDIO_DATA.musicSegments.map((seg, i) => (
                <MusicSegCard key={i} seg={seg} index={i}/>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: '16px 18px', background: 'var(--bg-elev)',
                          border: '1px solid var(--line)', borderRadius: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>导出音乐分析</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ fontSize: 12 }}><IcDownload size={13}/> music_analysis.json</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }}><IcSpark size={13}/> 生成 Udio 提示词</button>
              </div>
            </div>
          </div>
        )}

        {/* ─ Summary tab ─ */}
        {activeTab === 'summary' && (
          <div style={{ overflowY: 'auto', padding: '20px 24px', maxWidth: 760 }}>
            {/* Abstract */}
            <div style={{ marginBottom: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>摘要</div>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--ink-2)', margin: 0,
                           background: 'var(--bg-elev)', padding: '14px 16px', borderRadius: 12,
                           border: '1px solid var(--line)' }}>
                {AUDIO_DATA.summary.abstract}
              </p>
            </div>
            {/* Key points */}
            <div style={{ marginBottom: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>要点列表</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AUDIO_DATA.summary.keyPoints.map((pt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px',
                                         background: 'var(--bg-elev)', border: '1px solid var(--line)',
                                         borderRadius: 10, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', paddingTop: 3, flexShrink: 0 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {pt}
                  </div>
                ))}
              </div>
            </div>
            {/* Todos */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>待办事项</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AUDIO_DATA.summary.todos.map((td, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                         background: 'rgba(255,184,76,0.07)', border: '1px solid rgba(255,184,76,0.25)',
                                         borderRadius: 10, fontSize: 14, color: 'var(--ink-2)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--accent-warm)',
                                   flexShrink: 0 }}/>
                    {td}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn"><IcDownload size={13}/> 导出 .md</button>
              <button className="btn"><IcDownload size={13}/> 导出 .srt</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

window.AudioDetail = AudioDetail;
