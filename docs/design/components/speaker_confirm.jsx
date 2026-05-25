/* SpeakerConfirmModal — spec v1.1 §6.3
 *
 *  VAD + 声纹聚类后给每个 speaker 一个确认弹窗:
 *   - 3 × 5 秒示例片段(可点播)
 *   - 自动匹配的姓名(基于 Preflight 背景信息 · 置信度 ≥ 0.65 才预填)
 *   - 三个动作: 修改 / 确认 / 标为未知
 *
 *  默认人:张总 / 李总 / 产品负责人 (从 TASK_CONFIG.people)
 *  从 AudioDetail 的「校准说话人」按钮触发。
 */

const SC_DEFAULT_SPEAKERS = [
  {
    id: 'A',
    initials: 'A',
    color: 'var(--accent)',
    suggested: '张总',
    confidence: 0.88,
    samples: [
      { t: '00:00:05', text: '大家好,今天我们讨论 Q3 的内容策略方向。'  },
      { t: '00:00:58', text: '那我们先聚焦 C 端,用内容来建立品牌认知。' },
      { t: '00:02:02', text: '这很好。那分镜和脚本的审核流程能压缩吗?' },
    ],
    segments: 4,
    duration: '52 s',
  },
  {
    id: 'B',
    initials: 'B',
    color: 'var(--accent-2)',
    suggested: '李总',
    confidence: 0.72,
    samples: [
      { t: '00:00:18', text: '我觉得首先要明确目标受众,是 B 端还是 C 端。' },
      { t: '00:01:14', text: '视频类内容的完播率明显高于图文,建议加大投入。' },
      { t: '00:02:25', text: '可以引入 AI 工具辅助初稿,人工只审最终版本。' },
    ],
    segments: 4,
    duration: '48 s',
  },
  {
    id: 'C',
    initials: 'C',
    color: 'var(--accent-3)',
    suggested: '产品负责人',
    confidence: 0.51,  // < 0.65 → 不预填,保留 Speaker C
    samples: [
      { t: '00:00:32', text: '从产品角度看,两个方向都有机会,但资源分配需要取舍。' },
      { t: '00:01:38', text: '从数据来看,上季度我们的短视频转化率提升了 23%。' },
      { t: '00:02:48', text: '需要配套的提示词库,这块我们还没有系统化。' },
    ],
    segments: 4,
    duration: '34 s',
  },
];

/* mini waveform for the 5s sample · seeded by index so it's stable */
const SCWaveform = ({ seed = 0, playing = false, color = 'var(--ink-3)' }) => {
  const bars = Array.from({ length: 40 }, (_, i) => {
    const v = (Math.sin(seed * 1.7 + i * 0.6) + Math.sin(seed * 0.5 + i * 1.3) + 2) / 4;
    return 0.18 + v * 0.82;
  });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:1.5, height:24, flex:1, minWidth:0 }}>
      {bars.map((v, i) => (
        <div key={i} style={{
          flex:1, height:`${v * 100}%`, background:color, borderRadius:1,
          opacity: playing ? (0.45 + 0.55 * Math.sin((i + Date.now()/100) * 0.5) ** 2) : 0.85,
          transition:'opacity 80ms',
        }}/>
      ))}
    </div>
  );
};

/* Confidence bar */
const SCConfidence = ({ c }) => {
  const tone = c >= 0.8 ? 'var(--accent-green)'
             : c >= 0.65 ? 'var(--accent-warm)'
             : 'var(--ink-3)';
  const label = c >= 0.65 ? '已预填' : '置信度低 · 留空';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ width:36, height:3, background:'var(--bg-sunken)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:`${c * 100}%`, height:'100%', background:tone }}/>
      </div>
      <span className="mono" style={{ fontSize:10, color: tone }}>
        {Math.round(c * 100)}% · {label}
      </span>
    </div>
  );
};

/* ─── SpeakerConfirmModal ─── */
const SpeakerConfirmModal = ({ open, onClose, onConfirm, candidatePeople = '张总, 李总, 产品负责人' }) => {
  const initial = SC_DEFAULT_SPEAKERS.map(s => ({
    ...s,
    name:   s.confidence >= 0.65 ? s.suggested : '',
    unknown: false,
  }));
  const [rows, setRows] = React.useState(initial);
  const [playing, setPlaying] = React.useState(null); // `${spkId}-${sampleIdx}` | null

  // Reset state when re-opening
  React.useEffect(() => {
    if (open) { setRows(initial); setPlaying(null); }
    // eslint-disable-next-line
  }, [open]);

  const setRow = (id, patch) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  /* Auto-stop fake playback after 1.4s */
  React.useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setPlaying(null), 1400);
    return () => clearTimeout(t);
  }, [playing]);

  const filled = rows.filter(r => r.name.trim() || r.unknown).length;
  const total  = rows.length;

  return (
    <>
      <div className="modal-backdrop" data-open={open} onClick={onClose}/>
      <div className="modal" data-open={open} style={{ width:720 }}>
        <div className="m-head">
          <div style={{ flex:1, minWidth:0 }}>
            <div className="eyebrow" style={{ marginBottom:6 }}>
              CHECKPOINT · §6.3 · SPEAKER DIARIZATION
            </div>
            <h3 className="display" style={{ fontSize:24, margin:'0 0 6px', lineHeight:1.2 }}>
              检测到 <span style={{ color:'var(--accent)' }}>{total}</span> 位说话人,请确认
            </h3>
            <p style={{ margin:0, fontSize:13, color:'var(--ink-2)', lineHeight:1.55 }}>
              声纹聚类(pyannote · 余弦阈值 0.72)+ 背景信息「<b>{candidatePeople}</b>」自动匹配。
              对每位说话人试听 3 段示例后命名 · 不确定可「标为未知」。
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>

        <div className="m-body" style={{ padding:'8px 0 4px' }}>
          {rows.map((r, ri) => (
            <div key={r.id} style={{
              padding:'18px 24px',
              borderTop: ri === 0 ? 'none' : '1px solid var(--line)',
              display:'grid', gridTemplateColumns:'52px 1fr 220px', gap:18,
              alignItems:'flex-start',
              background: r.unknown ? 'var(--bg-sunken)' : 'transparent',
              opacity: r.unknown ? 0.75 : 1,
              transition:'all 160ms ease',
            }}>
              {/* Avatar */}
              <div style={{
                width:46, height:46, borderRadius:99,
                background: r.unknown ? 'var(--ink-4)' : r.color,
                display:'grid', placeItems:'center',
                color:'#fff', fontWeight:700, fontFamily:'var(--display)', fontSize:20,
                flexShrink:0,
              }}>
                {r.unknown ? '?' : r.initials}
              </div>

              {/* Center · meta + samples */}
              <div style={{ minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap',
                              marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--ink)' }}>
                    Speaker {r.id}
                  </span>
                  <span className="mono" style={{ fontSize:10, color:'var(--ink-3)' }}>
                    {r.segments} 段发言 · 累计 {r.duration}
                  </span>
                  <SCConfidence c={r.confidence}/>
                </div>
                {r.confidence < 0.65 && (
                  <div className="mono" style={{ fontSize:10, color:'var(--accent-warm)', marginBottom:6 }}>
                    ⚠ 与「{r.suggested}」相似度 {'< 65%'} · 未自动填入
                  </div>
                )}

                {/* 3 sample clips */}
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                  {r.samples.map((s, si) => {
                    const key = `${r.id}-${si}`;
                    const isPlaying = playing === key;
                    return (
                      <div key={si} style={{
                        display:'grid', gridTemplateColumns:'28px 60px 1fr', gap:10,
                        alignItems:'center', padding:'6px 0',
                      }}>
                        <button
                          onClick={() => setPlaying(isPlaying ? null : key)}
                          disabled={r.unknown}
                          style={{
                            width:24, height:24, borderRadius:99,
                            background: isPlaying ? r.color : 'var(--bg-sunken)',
                            color: isPlaying ? '#fff' : 'var(--ink-2)',
                            border:'none', cursor: r.unknown ? 'not-allowed' : 'pointer',
                            display:'grid', placeItems:'center', flexShrink:0,
                            transition:'all 120ms',
                          }}>
                          {isPlaying ? <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                     : <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>}
                        </button>
                        <span className="mono" style={{ fontSize:10, color:'var(--ink-3)', letterSpacing:'0.02em' }}>
                          {s.t} · 5s
                        </span>
                        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                          <SCWaveform seed={ri * 3 + si} playing={isPlaying} color={isPlaying ? r.color : 'var(--ink-3)'}/>
                        </div>
                        <div/>{/* spacer for grid alignment if needed */}
                        <div style={{ gridColumn:'2 / -1', fontSize:12, color: isPlaying ? 'var(--ink)' : 'var(--ink-3)',
                                       lineHeight:1.45, paddingLeft:0 }}>
                          {s.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right · name input + actions */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <input
                  value={r.name}
                  onChange={e => setRow(r.id, { name: e.target.value, unknown: false })}
                  disabled={r.unknown}
                  placeholder={r.suggested ? `建议 · ${r.suggested}` : '请输入姓名'}
                  className="pf-inp"
                  style={{ height:36, fontSize:13 }}/>
                <div style={{ display:'flex', gap:6 }}>
                  <button
                    onClick={() => setRow(r.id, { unknown: !r.unknown, name: r.unknown ? r.name : '' })}
                    style={{
                      flex:1, height:30, padding:'0 10px',
                      borderRadius:8, fontSize:11.5, cursor:'pointer',
                      border: `1px solid ${r.unknown ? 'var(--ink)' : 'var(--line)'}`,
                      background: r.unknown ? 'var(--ink)' : 'var(--bg-elev)',
                      color: r.unknown ? 'var(--bg)' : 'var(--ink-2)',
                      transition:'all 120ms',
                    }}>
                    {r.unknown ? '✓ 已标未知' : '标为未知'}
                  </button>
                  {!r.unknown && r.suggested && r.name !== r.suggested && (
                    <button
                      onClick={() => setRow(r.id, { name: r.suggested })}
                      style={{
                        flex:1, height:30, padding:'0 10px',
                        borderRadius:8, fontSize:11.5, cursor:'pointer',
                        border:'1px solid var(--line)', background:'var(--bg-elev)',
                        color:'var(--accent)',
                      }}>
                      用建议
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="m-foot">
          <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
            <span style={{ color: filled === total ? 'var(--accent-green)' : 'var(--accent-warm)' }}>●</span>
            {' '}{filled} / {total} 已确认 · 跳过将保留 Speaker A/B/C 标签
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" onClick={onClose}>跳过</button>
            <button className="btn-run"
                    disabled={filled < total}
                    style={{ opacity: filled < total ? 0.5 : 1 }}
                    onClick={() => onConfirm && onConfirm(rows)}>
              确认应用
              <span className="iconwrap"><IcCheck size={12}/></span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

window.SpeakerConfirmModal = SpeakerConfirmModal;
