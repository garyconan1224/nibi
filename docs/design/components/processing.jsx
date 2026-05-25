/* Processing — .proc-wrap, .step-row, .side-card, .tasklet */

/* 阶段 ID 严格对齐 spec v1.1 §11.1: download · probe · frames · asr · vlm · sum · store */
const STAGES = [
  { id:'download', ic: IcDownload, t:'下载',     s:'download', desc:'yt-dlp · bilibili dash · 仅链接来源。',          dur: 6 },
  { id:'probe',    ic: IcSearch,   t:'探测',     s:'probe',    desc:'识别格式 · 时长 · 字幕轨 · 音轨数。',            dur: 2 },
  { id:'frames',   ic: IcFilm,     t:'截帧',     s:'frames',   desc:'PySceneDetect + 1fps 采样 → 128帧。',           dur: 6 },
  { id:'asr',      ic: IcMic,      t:'转写',     s:'asr',      desc:'Whisper v3 large · 中文 · 带时间戳 SRT。',       dur: 14 },
  { id:'vlm',      ic: IcEye,      t:'视觉分析', s:'vlm',      desc:'Qwen-VL 逐帧 · OCR · 品牌符号 · 失败 3 次跳过。', dur: 12 },
  { id:'sum',      ic: IcCpu,      t:'总结',     s:'sum',      desc:'Claude 4.5 生成章节 · 要点 · 关键词。',          dur: 10 },
  { id:'store',    ic: IcLayers,   t:'入库',     s:'store',    desc:'写入任务数据库 · 索引 7 维度标签。',             dur: 2 },
];

const LOGS_BY = {
  download: [{t:'yt-dlp 1080p · bilibili dash · 387 MB @ 12 MB/s'}, {t:'合并视频 + 音轨 → BV1abc.mp4', k:'ok'}, {t:'提取音频 → audio.wav', k:'ok'}],
  probe:    [{t:'ffprobe · 6:42 · 24 fps · h264'}, {t:'内嵌字幕轨 #0 · zh · 弃用 (Whisper 重转)', k:'warn'}, {t:'音轨 × 1 · stereo · 44.1k', k:'ok'}],
  frames:   [{t:'PySceneDetect threshold=30 · 42 个场景边界'}, {t:'采样 128 帧 → /cache/BV1abc/', k:'ok'}],
  asr:      [{t:'Whisper v3 large · cuda · device=0'}, {t:'language=zh · conf=0.94'}, {t:'校正专有名词: Pocket / D-Log M / ProRes', k:'warn'}, {t:'SRT · 142段 · 6:42', k:'ok'}],
  vlm:      [{t:'Qwen-VL · batch=8 · 128 帧'}, {t:'视觉模型超时 · 重试中 1/3', k:'warn'}, {t:'识别霓虹 H · DJI logo · 4代并排'}, {t:'OCR × 23 处', k:'ok'}, {t:'帧 042 · 重试 3/3 失败 · 已跳过', k:'warn'}],
  sum:      [{t:'Claude-4.5 · 5 段 · 7 关键词'}, {t:'推荐切片 × 3 · Markdown 导出', k:'ok'}],
  store:    [{t:'索引 7 维度标签 → tag_lib'}, {t:'写入 task_db · 完成', k:'ok'}],
};

const Processing = ({ progress, onDone, onCancel, currentTaskId, onSwitchTask }) => {
  const total = STAGES.reduce((a,b) => a + b.dur, 0);
  const elapsed = progress * total;
  let acc = 0;
  const withState = STAGES.map(s => {
    const start = acc; acc += s.dur; const end = start + s.dur;
    let state = 'queued', p = 0;
    if (elapsed >= end) { state = 'done'; p = 1; }
    else if (elapsed > start) { state = 'running'; p = (elapsed - start) / s.dur; }
    return { ...s, state, p };
  });
  const frame = VM_DATA.FRAMES[Math.min(VM_DATA.FRAMES.length-1, Math.floor(progress*(VM_DATA.FRAMES.length-0.01)))];

  /* §11.3 · 活跃任务列表 (融合自原 TBQueue) · 用于侧栏切换 + 并行槽位计算 */
  const activeTasks = (() => {
    const seed = (VM_DATA.MATERIALS || []).filter(m => m.state==='running' || m.state==='queued' || m.state==='error' || m.id === currentTaskId);
    return seed.map(m => ({
      id: m.id, title: m.title, type: m.type, state: m.state, thumb: m.thumb,
      progress: m.progress ?? (m.state==='running' ? Math.round(progress*100)
                : m.state==='queued' ? 0
                : m.state==='error'  ? 38
                : 100),
      stage: m.state==='running' ? 'vlm · stage 4/6'
           : m.state==='queued'  ? '等待槽位'
           : m.state==='error'   ? 'API 超限'
           : '已完成',
    }));
  })();
  const runningCount = activeTasks.filter(t => t.state === 'running').length;
  const recommend = 6;                          // 本机推荐并行数
  const parallelLimit = Math.max(3, recommend); // 当前上限

  /* 顶部标题 · 切换当前任务时随之变化 */
  const currentTask = activeTasks.find(t => t.id === currentTaskId) || activeTasks[0];

  return (
    <div className="proc-wrap">
      <div className="proc-main">
        <div className="proc-hero">
          <div className="thumb">
            <div className="live">● LIVE</div>
            <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`}/>
          </div>
          <div className="info">
            <div className="eyebrow">PROCESSING · {(currentTask && currentTask.id) || 'BV1abc'}</div>
            <div className="title">{currentTask ? currentTask.title : '三代封神！那四代呢？'}
              {currentTask && currentTask.id === 'm1' && <><br/><span style={{fontSize:22,color:'var(--ink-3)'}}>大疆 Pocket 4 首发体验</span></>}
            </div>
            <div className="src">
              {(() => {
                const real = VM_DATA.MATERIALS.find(m => m.id === (currentTask && currentTask.id));
                return real ? `${real.source} · ${real.meta}` : 'bilibili.com/video/BV1abc · 1080p · 387 MB';
              })()}
            </div>
            <div className="stats">
              <span><strong>6:42</strong> 时长</span>
              <span><strong>128</strong> 帧</span>
              <span><strong>142</strong> 句转录</span>
              <span>剩余 <strong>{Math.max(0,Math.round((1-progress)*total))}s</strong></span>
            </div>
            <div style={{marginTop:16, display:'flex', gap:8, alignItems:'center'}}>
              <button className="btn" onClick={onCancel}><IcX size={14}/>取消</button>
              <button className="btn btn-primary" onClick={onDone}
                style={{opacity: progress < 1 ? 0.5 : 1, cursor: progress < 1 ? 'not-allowed' : 'pointer'}}>
                查看结果 <IcArrowRight size={14}/>
              </button>
              {progress >= 1 && (
                <span className="chip" style={{background:'rgba(34,211,154,0.12)', color:'var(--accent-green)', borderColor:'rgba(34,211,154,0.3)'}}>
                  <span className="chip-dot" style={{background:'var(--accent-green)'}}/>
                  完成 · 自动跳转中…
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="step-stream">
          {withState.map((s, i) => {
            const allLogs = LOGS_BY[s.id] || [];
            const visLogs = s.state === 'done' ? allLogs : allLogs.slice(0, Math.ceil(s.p * allLogs.length));
            return (
              <div key={s.id} className="step-row" data-state={s.state}>
                <div className="ico">
                  {s.state === 'done' ? <IcCheck size={20}/> :
                   s.state === 'running' ? <div className="spinner"/> : <s.ic size={18}/>}
                </div>
                <div className="body">
                  <div className="hd">
                    {s.t}
                    <span className="kbd mono">{s.s}</span>
                  </div>
                  <div className="desc">{s.desc}</div>
                  {visLogs.length > 0 && (
                    <div className="logs">
                      {visLogs.map((l,j) => {
                        const color = l.k === 'err'  ? 'var(--accent)'
                                    : l.k === 'warn' ? 'var(--accent-warm)'
                                    : l.k === 'ok'   ? 'var(--accent-green)'
                                    : null;
                        return (
                          <div key={j} className={`ln ${l.k||''}`}
                               style={color ? { color } : null}>
                            {l.k === 'warn' && <span style={{marginRight:6}}>⚠</span>}
                            {l.k === 'err'  && <span style={{marginRight:6}}>✗</span>}
                            {l.k === 'ok'   && <span style={{marginRight:6}}>✓</span>}
                            {l.t}
                          </div>
                        );
                      })}
                      {s.state === 'running' && <div className="ln">▌</div>}
                    </div>
                  )}
                </div>
                <div className="progress">
                  <div className="pct">{s.state==='queued'?'—': s.state==='done'?'✓ DONE':`${Math.round(s.p*100)}%`}</div>
                  <div className="bar"><div className="fill" style={{width:`${s.p*100}%`}}/></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="proc-side">
        <div className="side-card">
          <h4>系统资源 <span className="chip"><span className="chip-dot"/>GPU active</span></h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[['GPU','71%','RTX 4090 · 24G'],['RAM','18.2G','/ 64 GB DDR5'],['VRAM','16.1G','/ 24 GB'],['ETA',`${Math.max(0,Math.round((1-progress)*total))}s`,'剩余时间']].map(([l,v,s])=>(
              <div key={l}>
                <div className="eyebrow" style={{marginBottom:4}}>{l}</div>
                <div style={{fontFamily:'var(--display)',fontSize:28,lineHeight:1}}>{v}</div>
                <div style={{color:'var(--ink-3)',fontSize:11,marginTop:3}}>{s}</div>
              </div>
            ))}
          </div>
          {/* 并行槽位 · 从 TBQueue 迁移过来的信息 */}
          <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--line)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <span className="eyebrow">并行槽位</span>
              <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
                <b style={{ color:'var(--ink)', fontSize:13 }}>{runningCount}</b> / {parallelLimit}
                <span style={{ marginLeft:6, color:'var(--accent-green)' }}>推荐 {recommend}</span>
              </span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {Array.from({ length: parallelLimit }).map((_, i) => (
                <div key={i} style={{
                  flex:1, height:5, borderRadius:3,
                  background: i < runningCount ? 'var(--ink)' : 'var(--bg-sunken)',
                  border: i < runningCount ? 'none' : '1px dashed var(--line)',
                }}/>
              ))}
            </div>
            <div className="mono" style={{ fontSize:10, color:'var(--ink-4)', marginTop:6 }}>
              CPU 16核 · RAM 64GB · RTX 4090 24GB
            </div>
          </div>
        </div>

        <div className="side-card">
          <h4>
            任务
            <span className="mono" style={{fontSize:10,opacity:0.6}}>{activeTasks.length} 个活跃 · 点击切换</span>
          </h4>
          {activeTasks.map(t => {
            const f = VM_DATA.FRAMES[t.thumb % VM_DATA.FRAMES.length];
            const dotCls = {running:'running',done:'done',error:'err',queued:'queued'}[t.state]||'queued';
            const isActive = currentTaskId === t.id;
            const prog = t.progress ?? (t.state==='queued'?0:t.state==='error'?38:50);
            return (
              <div key={t.id} className="tasklet"
                   onClick={() => onSwitchTask && onSwitchTask(t.id)}
                   style={{
                     padding:'10px 12px', margin:'0 -12px',
                     borderRadius:10,
                     background: isActive ? 'var(--bg-sunken)' : 'transparent',
                     borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                     borderBottom: '1px solid var(--line)',
                   }}>
                <div className="tl-thumb"><img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/></div>
                <div className="tl-body">
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div className="tl-title" style={{ flex:1, minWidth:0 }}>{t.title}</div>
                    {isActive && (
                      <span className="mono" style={{ fontSize:9, color:'var(--accent)', flexShrink:0,
                                                       padding:'1px 5px', border:'1px solid var(--accent)', borderRadius:4,
                                                       letterSpacing:'0.04em' }}>
                        查看中
                      </span>
                    )}
                  </div>
                  <div className="tl-meta">
                    <span className={`dot ${dotCls}`}/>
                    <span>{t.state}</span>
                    <span style={{opacity:0.4}}>·</span>
                    <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.stage || t.type}</span>
                    {t.state==='error' && (
                      <button className="btn btn-ghost"
                              style={{ height:18, padding:'0 6px', fontSize:9.5 }}
                              onClick={(e) => { e.stopPropagation(); alert('Retry queued (mock)'); }}>重试</button>
                    )}
                  </div>
                  {/* 侧栏进度条 · 增加清晰度 */}
                  <div style={{ marginTop:6, height:2, background:'var(--bg-sunken)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', width:`${prog}%`,
                      background: t.state==='error' ? 'var(--accent)'
                                : t.state==='done'  ? 'var(--accent-green)'
                                : t.state==='running' ? 'var(--ink)'
                                : 'var(--ink-4)',
                    }}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="side-card">
          <h4>预览帧 <span className="mono" style={{fontSize:10,opacity:0.6}}>{frame.ts}</span></h4>
          <div style={{borderRadius:12,overflow:'hidden',marginBottom:10}}>
            <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`} style={{width:'100%',display:'block'}}/>
          </div>
          <div style={{fontSize:12,fontWeight:600}}>{frame.title}</div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginTop:3}}>{frame.subtitle}</div>
        </div>
      </aside>
    </div>
  );
};

window.Processing = Processing;
