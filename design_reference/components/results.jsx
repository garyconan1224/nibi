/* Results — .result-wrap, .result-nav, .rn-item, .summary-card, .timeline-card, .panel-grid */

const renderMD = (md) => {
  const lines = md.trim().split('\n');
  const out = []; let ul = null;
  const flush = () => { if (ul) { out.push(<ul key={`u${out.length}`}>{ul}</ul>); ul = null; } };
  lines.forEach((raw, i) => {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); return; }
    if (l.startsWith('### ')) { flush(); out.push(<h3 key={i}>{l.slice(4)}</h3>); return; }
    if (l.startsWith('## '))  { flush(); out.push(<h2 key={i}>{l.slice(3)}</h2>); return; }
    if (l.startsWith('# '))   { flush(); out.push(<h2 key={i}>{l.slice(2)}</h2>); return; }
    if (l.startsWith('> '))   { flush(); out.push(<blockquote key={i}>{inl(l.slice(2))}</blockquote>); return; }
    if (/^[-*] /.test(l.trim())) {
      if (!ul) ul = [];
      ul.push(<li key={`li${i}`}>{inl(l.trim().slice(2))}</li>); return;
    }
    flush();
    out.push(<p key={i}>{inl(l)}</p>);
  });
  flush(); return out;
};
function inl(s) {
  const parts = []; let rest = s, k = 0;
  while (rest) {
    const m = rest.match(/\*\*([^*]+)\*\*|`([^`]+)`/);
    if (!m) { parts.push(rest); break; }
    if (m.index) parts.push(rest.slice(0, m.index));
    if (m[1]) parts.push(<strong key={k++}>{m[1]}</strong>);
    if (m[2]) parts.push(<code key={k++}>{m[2]}</code>);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts;
}

const Results = ({ layout, onOpenStoryboard }) => {
  const [activeFrame, setActiveFrame] = React.useState(2);
  const [activeTab, setActiveTab] = React.useState('notes');
  const [activeResult, setActiveResult] = React.useState('summary');
  const frame = VM_DATA.FRAMES[activeFrame];

  const navItems = [
    { id:'summary',    n:'01', t:'总览 · Summary' },
    { id:'timeline',   n:'02', t:'时间轴 · Timeline' },
    { id:'panels',     n:'03', t:'转录 + 笔记' },
    { id:'storyboard', n:'04', t:'分镜 · Storyboard' },
  ];

  return (
    <div className="result-wrap" data-layout={layout}>
      {/* ─── Left nav ─── */}
      <aside className="result-nav">
        <div className="rn-card">
          <div className="rn-thumb">
            <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`}/>
            <div className="play"><button className="play-btn"><IcPlay size={20}/></button></div>
          </div>
          <div className="rn-meta">
            <div className="rn-title">三代封神！那四代呢？大疆 Pocket 4 首发体验</div>
            <div className="rn-sub">BV1abc · 6:42 · 影视飓风 · 中文</div>
          </div>
        </div>

        <div className="rn-section">
          <div className="rn-sec-title">结果视图</div>
          {navItems.map(it => (
            <div key={it.id} className="rn-item" data-active={activeResult===it.id}
                 onClick={() => { setActiveResult(it.id); if(it.id==='storyboard') onOpenStoryboard(); }}>
              <span className="rn-num">{it.n}</span>
              {it.t}
              <span className="rn-dot"/>
            </div>
          ))}
        </div>

        <div style={{marginTop:14, display:'flex', gap:8, flexDirection:'column'}}>
          <button className="btn"><IcDownload size={14}/>导出 .md</button>
          <button className="btn"><IcDownload size={14}/>导出 .srt</button>
          <button className="btn btn-primary" onClick={onOpenStoryboard}><IcWand size={14}/>进入分镜</button>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="result-main">

        {/* ─── Summary ─── */}
        {(activeResult === 'summary' || activeResult === 'timeline' || activeResult === 'panels') && (
          <div className="summary-card">
            <div className="eyebrow">OVERVIEW · BV1abc · 完成</div>
            <div className="quote">
              便携与专业的结合:Pocket 4 通过 <em>1英寸大底 + D-Log M</em> 重新定义了口袋相机的天花板——不是最炸裂,但是<em>最趁手</em>。
            </div>
            <div className="tag-row">
              <span className="tag pink">便携专业</span>
              <span className="tag purple">迭代进化</span>
              <span className="tag blue">日常记录</span>
              <span className="tag">1英寸大底</span>
              <span className="tag">D-Log M</span>
              <span className="tag">ProRes RAW</span>
              <span className="tag">情感化</span>
            </div>
            <div className="stat-row">
              <div className="stat-cell"><div className="label">时长</div><div className="value">6:42</div></div>
              <div className="stat-cell"><div className="label">关键帧</div><div className="value">128</div></div>
              <div className="stat-cell"><div className="label">转录段落</div><div className="value">142</div></div>
              <div className="stat-cell"><div className="label">切片建议</div><div className="value">3</div></div>
            </div>
          </div>
        )}

        {/* ─── Timeline ─── */}
        {(activeResult === 'timeline' || activeResult === 'summary') && (
          <div className="timeline-card">
            <div className="sect-head">
              <h2>时间轴</h2>
              <span className="sub">点击帧跳转到转录对应位置</span>
            </div>
            <div className="timeline-track">
              <div className="tl-ruler">
                <span>0:00</span><span>1:00</span><span>2:00</span>
                <span>3:00</span><span>4:00</span><span>5:00</span><span>6:42</span>
              </div>
              <div className="tl-strip">
                {VM_DATA.FRAMES.map((f, i) => (
                  <div key={i} className="tl-frame" data-active={i===activeFrame}
                       onClick={() => setActiveFrame(i)}>
                    <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
                    <div className="tl-ts">{f.ts}</div>
                    <div className="tl-tag">{f.title}</div>
                  </div>
                ))}
              </div>
              <div className="tl-scrubber">
                <div className="playhead" style={{left:`${(activeFrame/(VM_DATA.FRAMES.length-1))*100}%`}}/>
                <div className="wave">
                  {Array.from({length:120}).map((_,i)=>{
                    const h = 14 + (Math.sin(i*0.7)*0.5 + Math.sin(i*0.25+1)*0.5 + 1) * 0.5 * 28;
                    return <span key={i} style={{height:`${h}px`}}/>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Panel grid: Transcript + Notes ─── */}
        {activeResult === 'panels' && (
          <div className="panel-grid">
            <div className="panel">
              <div className="p-head">
                <h3><IcMic size={14}/>转录 · Transcript</h3>
                <button className="btn btn-ghost" style={{height:28}}><IcDownload size={13}/>.srt</button>
              </div>
              <div className="p-body">
                {VM_DATA.TRANSCRIPT.map((l, i) => {
                  const sec = l.t.split(':').reduce((a,b,i)=>a+(i===0?Number(b)*60:Number(b)),0);
                  const nf = VM_DATA.FRAMES.reduce((best,f,fi)=>Math.abs(f.sec-sec)<Math.abs(VM_DATA.FRAMES[best].sec-sec)?fi:best, 0);
                  return (
                    <div key={i} className="tr-line" data-active={nf===activeFrame}
                         onClick={()=>setActiveFrame(nf)}>
                      <span className="ts">{l.t}</span>
                      <span className="txt">{l.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel">
              <div className="p-head">
                <h3><IcText size={14}/>AI 笔记 · Notes</h3>
                <button className="btn btn-ghost" style={{height:28}}><IcDownload size={13}/>.md</button>
              </div>
              <div className="p-body">
                <div className="md-body">{renderMD(VM_DATA.NOTES_MD)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Mindmap placeholder */}
        {activeResult === 'summary' && (
          <div className="timeline-card">
            <div className="sect-head"><h2>思维导图</h2></div>
            <div className="mindmap">
              <svg viewBox="0 0 640 260">
                {[
                  {x:320,y:130,r:36,t:'Pocket 4',f:true},
                  {x:120,y:60,r:28,t:'结构',f:false},{x:120,y:130,r:28,t:'升级',f:false},
                  {x:120,y:200,r:28,t:'场景',f:false},{x:520,y:60,r:28,t:'1英寸',f:false},
                  {x:520,y:130,r:28,t:'D-Log M',f:false},{x:520,y:200,r:28,t:'ProRes',f:false},
                ].map((n,i)=>(
                  <g key={i}>
                    {!n.f && <line x1={320} y1={130} x2={n.x} y2={n.y} stroke="var(--line-strong)" strokeWidth="1.2"/>}
                    <circle cx={n.x} cy={n.y} r={n.r} fill={n.f?'var(--ink)':'var(--bg-elev)'} stroke={n.f?'none':'var(--line-strong)'}/>
                    <text x={n.x} y={n.y+4} textAnchor="middle" fontSize={n.f?12:10}
                          fontWeight={n.f?700:500} fill={n.f?'var(--bg)':'var(--ink)'}>{n.t}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.Results = Results;
