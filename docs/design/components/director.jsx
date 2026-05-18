/* Director · 复刻工坊 (Remix Kit) — PRD §10
   Tabs: 收藏帧 · 提示词版本 · A/B 对比 · 风格 DNA · AI 对谈
   Reuses VidMirror tokens / styles — no new visual language. */

(() => {

const TABS = [
  { id:'kit',     label:'复刻清单',  sub:'Favorites Kit',  ic: IcStar },
  { id:'prompt',  label:'提示词版本', sub:'Prompt Tree',   ic: IcWand },
  { id:'compare', label:'A/B 对比',  sub:'Compare',        ic: IcCompare },
  { id:'dna',     label:'风格 DNA',  sub:'Style Report',   ic: IcSpark },
  { id:'chat',    label:'AI 对谈',   sub:'Director Chat',  ic: IcSend },
];

/* ─── Tab 1: Favorites Kit ─── */
const FavoritesKit = () => {
  const favs = VM_DATA.FAVORITES;
  const [activeId, setActiveId] = React.useState(favs[0].id);
  const active = favs.find(f => f.id === activeId);
  const f = VM_DATA.FRAMES[active.thumb % VM_DATA.FRAMES.length];

  return (
    <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:0, height:'100%', minHeight:0}}>
      {/* Left list */}
      <div style={{borderRight:'1px solid var(--line)', overflowY:'auto', padding:16}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <div className="eyebrow">收藏帧 · {favs.length}</div>
          <button className="btn btn-ghost" style={{height:28, padding:'0 8px', fontSize:11}}>
            <IcPlus size={12}/>添加
          </button>
        </div>
        {favs.map(fav => {
          const fr = VM_DATA.FRAMES[fav.thumb % VM_DATA.FRAMES.length];
          return (
            <div key={fav.id}
                 onClick={() => setActiveId(fav.id)}
                 data-active={fav.id===activeId}
                 className="d-task" style={{marginBottom:8, cursor:'pointer'}}>
              <div className="dt-thumb">
                <img src={`assets/frame_${fr.ts.replace(/:/g,'_')}.svg`}/>
              </div>
              <div className="dt-body">
                <div className="dt-title" style={{fontSize:12}}>{fav.note}</div>
                <div className="dt-meta">
                  <span className="mono" style={{fontSize:10}}>{fav.material}</span>
                  <span style={{opacity:0.4}}>·</span>
                  <span className="mono" style={{fontSize:10}}>{fav.ts}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right detail */}
      <div style={{overflowY:'auto', padding:'24px 32px'}}>
        <div className="eyebrow" style={{marginBottom:8}}>FAVORITE · {active.id.toUpperCase()}</div>
        <div className="display" style={{fontSize:32, margin:'0 0 20px', lineHeight:1.1}}>{active.note}</div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24}}>
          <div>
            <div className="eyebrow" style={{marginBottom:8}}>参考帧</div>
            <div style={{borderRadius:14, overflow:'hidden', border:'1px solid var(--line)'}}>
              <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`} style={{width:'100%', display:'block'}}/>
            </div>
            <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
              <span className="tag mono">{active.ts}</span>
              <span className="tag mono">{active.material}</span>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{marginBottom:8}}>生成提示词 (auto)</div>
            <div style={{
              background:'var(--bg-sunken)', border:'1px solid var(--line)',
              borderRadius:14, padding:'14px 16px',
              fontFamily:'var(--mono)', fontSize:12, lineHeight:1.6,
              color:'var(--ink-2)', minHeight:140,
            }}>
              {active.prompt}
            </div>
            <div style={{display:'flex', gap:8, marginTop:10}}>
              <button className="btn btn-primary" style={{height:32}}><IcWand size={13}/>用此 prompt 生成</button>
              <button className="btn" style={{height:32}}><IcEdit size={13}/>编辑</button>
              <button className="btn btn-ghost" style={{height:32}}><IcShare size={13}/></button>
            </div>
          </div>
        </div>

        <div className="eyebrow" style={{marginBottom:10}}>已生成结果 · 4 张</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
          {[2,5,4,6].map((i,k) => {
            const fr = VM_DATA.FRAMES[i];
            return (
              <div key={k} style={{position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid var(--line)', cursor:'pointer'}}>
                <img src={`assets/frame_${fr.ts.replace(/:/g,'_')}.svg`} style={{width:'100%', display:'block'}}/>
                <div style={{position:'absolute', top:6, left:6, fontFamily:'var(--mono)', fontSize:9, color:'#fff', background:'rgba(0,0,0,0.55)', padding:'2px 6px', borderRadius:6}}>
                  v{k+1}
                </div>
                {k === 2 && (
                  <div style={{position:'absolute', top:6, right:6, fontFamily:'var(--mono)', fontSize:9, color:'#fff', background:'var(--accent-green)', padding:'2px 6px', borderRadius:6}}>
                    ★ pick
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─── Tab 2: Prompt Tree (version history) ─── */
const PromptTree = () => {
  const versions = VM_DATA.PROMPT_VERSIONS;
  const [activeV, setActiveV] = React.useState(versions.find(v => v.active)?.v || versions[versions.length-1].v);
  const active = versions.find(v => v.v === activeV);

  return (
    <div style={{padding:'24px 32px', overflowY:'auto', height:'100%'}}>
      <div style={{display:'flex', alignItems:'baseline', gap:14, marginBottom:6}}>
        <div className="display" style={{fontSize:30, margin:0, lineHeight:1.1}}>
          锚点提示词 · <span style={{color:'var(--accent)'}}>霓虹 H</span>
        </div>
        <span className="tag mono">f2 · 00:01:32</span>
      </div>
      <div className="eyebrow" style={{marginBottom:24}}>{versions.length} 个版本 · 由 f2 自动派生</div>

      <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:24}}>
        {/* version timeline */}
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>版本树</div>
          <div style={{position:'relative'}}>
            {/* trunk line */}
            <div style={{position:'absolute', left:14, top:8, bottom:8, width:1, background:'var(--line-strong)'}}/>
            {versions.map((v, i) => {
              const isActive = v.v === activeV;
              return (
                <div key={v.v} onClick={() => setActiveV(v.v)}
                     style={{
                       display:'flex', alignItems:'flex-start', gap:14,
                       padding:'10px 0', cursor:'pointer', position:'relative',
                     }}>
                  <div style={{
                    width:28, height:28, borderRadius:99,
                    background: isActive ? 'var(--ink)' : 'var(--bg-elev)',
                    color: isActive ? 'var(--bg-elev)' : 'var(--ink)',
                    border:'1px solid var(--line-strong)',
                    display:'grid', placeItems:'center',
                    fontFamily:'var(--mono)', fontSize:11, fontWeight:600,
                    flexShrink:0, position:'relative', zIndex:1,
                  }}>{v.v}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight: isActive ? 600 : 500, color:'var(--ink)'}}>
                      {v.note}
                      {v.active && <span className="tag mono" style={{marginLeft:8, fontSize:9, padding:'1px 6px'}}>当前</span>}
                    </div>
                    <div style={{display:'flex', gap:6, marginTop:3, fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-3)'}}>
                      <span>{v.at}</span>
                      <span>·</span>
                      <span>by {v.by}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn" style={{height:30, marginTop:8, width:'100%'}}>
            <IcPlus size={12}/>新建分支版本
          </button>
        </div>

        {/* version detail */}
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>{active.v} · {active.note}</div>
          <div style={{
            background:'var(--bg-sunken)', border:'1px solid var(--line)',
            borderRadius:14, padding:'16px 18px',
            fontFamily:'var(--mono)', fontSize:13, lineHeight:1.65,
            color:'var(--ink)', whiteSpace:'pre-wrap',
          }}>
            {active.text}
          </div>

          <div style={{display:'flex', gap:8, margin:'14px 0 24px'}}>
            <button className="btn btn-primary" style={{height:32}}><IcWand size={13}/>生成 4 张</button>
            <button className="btn" style={{height:32}}><IcEdit size={13}/>派生新版本</button>
            <button className="btn btn-ghost" style={{height:32}}><IcCompare size={13}/>与 v{Math.max(1, parseInt(active.v.slice(1))-1)} 对比</button>
            <div style={{flex:1}}/>
            <button className="btn btn-ghost" style={{height:32}}><IcShare size={13}/></button>
          </div>

          {/* diff preview */}
          <div className="eyebrow" style={{marginBottom:10}}>{active.v} 与上一版的差异</div>
          <div style={{
            background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, padding:14,
            fontFamily:'var(--mono)', fontSize:12, lineHeight:1.7,
          }}>
            <div style={{color:'var(--accent-green)'}}>+ volumetric fog, wet asphalt, blade runner mood</div>
            <div style={{color:'var(--accent-green)'}}>+ --s 250</div>
            <div style={{color:'var(--ink-3)'}}>  保留: anamorphic lens flare, teal + magenta</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Tab 3: A/B Compare ─── */
const Compare = () => {
  const c = VM_DATA.COMPARE;
  const ref = VM_DATA.FRAMES[c.reference.thumb];
  const gen = VM_DATA.FRAMES[c.generated.thumb];

  return (
    <div style={{padding:'24px 32px', overflowY:'auto', height:'100%'}}>
      <div style={{display:'flex', alignItems:'baseline', gap:14, marginBottom:6}}>
        <div className="display" style={{fontSize:30, margin:0, lineHeight:1.1}}>{c.precision}</div>
        <span className="tag mono">overall · {c.score}%</span>
      </div>
      <div className="eyebrow" style={{marginBottom:24}}>原作 ↔ 生成 · 5 维度</div>

      {/* Side-by-side */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24}}>
        <div>
          <div className="eyebrow" style={{marginBottom:8}}>参考 · 原作</div>
          <div style={{borderRadius:14, overflow:'hidden', border:'1px solid var(--line)'}}>
            <img src={`assets/frame_${ref.ts.replace(/:/g,'_')}.svg`} style={{width:'100%', display:'block'}}/>
          </div>
          <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:6}}>{c.reference.label}</div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:8}}>生成结果</div>
          <div style={{borderRadius:14, overflow:'hidden', border:'1px solid var(--line)', position:'relative'}}>
            <img src={`assets/frame_${gen.ts.replace(/:/g,'_')}.svg`} style={{width:'100%', display:'block'}}/>
            <div style={{
              position:'absolute', top:10, right:10,
              background:'var(--ink)', color:'var(--bg-elev)',
              fontFamily:'var(--mono)', fontSize:11, fontWeight:600,
              padding:'4px 10px', borderRadius:8,
            }}>{c.score}%</div>
          </div>
          <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:6}}>{c.generated.label}</div>
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="eyebrow" style={{marginBottom:10}}>分维度匹配度</div>
      <div style={{
        background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden',
        marginBottom:24,
      }}>
        {c.deltas.map((d, i) => {
          const tone = d.match >= 80 ? 'var(--accent-green)' : d.match >= 70 ? '#FFB84C' : 'var(--accent)';
          return (
            <div key={d.dim} style={{
              display:'grid', gridTemplateColumns:'80px 80px 1fr',
              gap:14, padding:'14px 18px',
              borderBottom: i < c.deltas.length-1 ? '1px solid var(--line)' : 'none',
              alignItems:'center',
            }}>
              <div style={{fontSize:13, fontWeight:600}}>{d.dim}</div>
              <div style={{fontFamily:'var(--mono)', fontSize:14, fontWeight:600, color:tone}}>{d.match}%</div>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <div style={{flex:1, height:6, background:'var(--bg-sunken)', borderRadius:99, overflow:'hidden'}}>
                  <div style={{width:`${d.match}%`, height:'100%', background:tone, borderRadius:99}}/>
                </div>
                <div style={{fontSize:11, color:'var(--ink-2)', width:'52%', flexShrink:0}}>{d.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI suggestions */}
      <div className="eyebrow" style={{marginBottom:10}}>AI 修正建议</div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {c.suggestions.map((s,i) => (
          <div key={i} style={{
            background:'var(--bg-sunken)', border:'1px solid var(--line)',
            borderRadius:12, padding:'12px 14px',
            fontSize:13, lineHeight:1.55, display:'flex', gap:10,
          }}>
            <div style={{
              width:22, height:22, borderRadius:99, background:'var(--ink)', color:'var(--bg-elev)',
              fontFamily:'var(--mono)', fontSize:11, display:'grid', placeItems:'center', flexShrink:0,
            }}>{i+1}</div>
            <div style={{flex:1, fontFamily:'var(--mono)', fontSize:12}}>{s}</div>
            <button className="btn btn-ghost" style={{height:24, padding:'0 8px', fontSize:10}}>应用</button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Tab 4: Style DNA Report ─── */
const StyleDNA = () => {
  const r = VM_DATA.STYLE_REPORT;

  return (
    <div style={{padding:'24px 32px', overflowY:'auto', height:'100%'}}>
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:6}}>
        <div>
          <div className="display" style={{fontSize:30, margin:0, lineHeight:1.1}}>
            {r.author} · 风格 DNA
          </div>
          <div className="eyebrow" style={{marginTop:4}}>基于 {r.materials} 个素材 · 生成于 {r.generated}</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn"><IcDownload size={13}/>导出 PDF</button>
          <button className="btn btn-primary"><IcWand size={13}/>套用此风格</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20, marginTop:24}}>
        {/* Left col: wordcloud + advice */}
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {/* Word cloud */}
          <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, padding:'18px 20px'}}>
            <div className="eyebrow" style={{marginBottom:14}}>风格关键词</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:'10px 14px', alignItems:'baseline', lineHeight:1}}>
              {r.wordcloud.map((w, i) => {
                const colors = ['var(--ink)', 'var(--accent)', 'var(--ink-2)', 'var(--ink-3)'];
                return (
                  <span key={i} style={{
                    fontFamily:'var(--display)',
                    fontSize: w.size,
                    color: colors[i % colors.length],
                    letterSpacing:'-0.01em',
                  }}>{w.w}</span>
                );
              })}
            </div>
          </div>

          {/* Advice */}
          <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, padding:'18px 20px'}}>
            <div className="eyebrow" style={{marginBottom:12}}>复刻建议</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {r.advice.map((a, i) => (
                <div key={i} style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                  <div style={{
                    width:20, height:20, borderRadius:99, background:'var(--accent)',
                    color:'#fff', fontFamily:'var(--mono)', fontSize:10, fontWeight:700,
                    display:'grid', placeItems:'center', flexShrink:0,
                  }}>{i+1}</div>
                  <div style={{fontSize:13, lineHeight:1.55, paddingTop:1}}>{a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col: palette + shots + music */}
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {/* Palette */}
          <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, padding:'18px 20px'}}>
            <div className="eyebrow" style={{marginBottom:12}}>主色板</div>
            <div style={{display:'flex', borderRadius:10, overflow:'hidden', height:64, marginBottom:8}}>
              {r.palette.map((c, i) => (
                <div key={i} style={{flex:1, background:c}}/>
              ))}
            </div>
            <div style={{display:'flex', gap:'4px 6px', flexWrap:'wrap'}}>
              {r.palette.map((c, i) => (
                <span key={i} className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{c}</span>
              ))}
            </div>
          </div>

          {/* Shots distribution */}
          <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, padding:'18px 20px'}}>
            <div className="eyebrow" style={{marginBottom:14}}>镜头分布</div>
            {Object.entries(r.shots).map(([k,v]) => {
              const total = Object.values(r.shots).reduce((a,b)=>a+b,0);
              const pct = Math.round(v / total * 100);
              return (
                <div key={k} style={{marginBottom:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12}}>
                    <span>{k}</span>
                    <span className="mono" style={{color:'var(--ink-3)'}}>{v} · {pct}%</span>
                  </div>
                  <div style={{height:5, background:'var(--bg-sunken)', borderRadius:99, overflow:'hidden'}}>
                    <div style={{width:`${pct}%`, height:'100%', background:'var(--ink)', borderRadius:99}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Music */}
          <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:14, padding:'18px 20px'}}>
            <div className="eyebrow" style={{marginBottom:12}}>音乐特征</div>
            <div style={{display:'flex', flexDirection:'column', gap:8, fontSize:13}}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'var(--ink-3)'}}>BPM</span>
                <span className="mono" style={{fontWeight:600}}>{r.music.bpm}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'var(--ink-3)'}}>调性</span>
                <span className="mono" style={{fontWeight:600}}>{r.music.keys.join(' · ')}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'var(--ink-3)'}}>风格</span>
                <span className="mono" style={{fontWeight:600}}>{r.music.genres.join(' · ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Tab 5: Director Chat (existing component, simplified inline) ─── */
const DirectorChat = () => {
  const [input, setInput] = React.useState('');
  const msgs = [
    { r:'ai',   t:'我已读完这条 6:42 的 Pocket 4 视频。最值得做成内容的 3 个钩子:\n① 0:12 "我是非常困惑的" — 反常识开场\n② 3:30 Pocket 3 vs 4 分屏 — 视觉证据\n③ 5:54 海滩日落 — 情感共鸣\n\n你想改编成哪个方向？' },
    { r:'user', t:'帮我剪一条 30 秒抖音切片，钩子要狠' },
    { r:'ai',   t:'建议 Variant C(反转·脱口秀):\n① 0–3s "这代我真的不想买" 大字幕\n② 3–15s 分屏翻盘\n③ 15–25s 海滩实拍 + 真香转折\n④ 25–30s "真香" 定格\n\n已生成分镜 → 点击"进入分镜"查看。' },
  ];
  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
      <div style={{flex:1, padding:'20px 32px', overflowY:'auto', display:'flex', flexDirection:'column', gap:16}}>
        {msgs.map((m,i) => (
          <div key={i} style={{display:'flex', gap:12, alignItems:'flex-start', flexDirection: m.r==='user'?'row-reverse':'row'}}>
            <div style={{width:32, height:32, borderRadius:99, background: m.r==='ai'?'var(--ink)':'var(--bg-sunken)', border:'1px solid var(--line)', display:'grid', placeItems:'center', flexShrink:0}}>
              {m.r==='ai' ? <LogoMark size={18}/> : <span className="mono" style={{fontSize:10}}>you</span>}
            </div>
            <div style={{maxWidth:'70%', background: m.r==='ai'?'var(--bg-elev)':'var(--bg-sunken)', border:'1px solid var(--line)', borderRadius: m.r==='ai'?'4px 18px 18px 18px':'18px 4px 18px 18px', padding:'12px 16px', fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap'}}>
              {m.t}
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'14px 24px', borderTop:'1px solid var(--line)', display:'flex', gap:10, alignItems:'center'}}>
        <IcSpark size={16} style={{color:'var(--ink-3)', flexShrink:0}}/>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="告诉 AI 导演你想要什么——切片、改编、复刻..."
          style={{flex:1, background:'transparent', border:'none', outline:'none', fontSize:14}}/>
        <button className="btn btn-primary"><IcSend size={14}/>发送</button>
      </div>
    </div>
  );
};

/* ─── Main Director shell with tabs ─── */
const Director = () => {
  const [tab, setTab] = React.useState('kit');

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%', minHeight:0}}>
      {/* Header */}
      <div style={{padding:'18px 32px 0', borderBottom:'1px solid var(--line)', flexShrink:0}}>
        <div style={{display:'flex', alignItems:'baseline', gap:14, marginBottom:14}}>
          <LogoMark size={26}/>
          <div>
            <div className="eyebrow">REMIX KIT · 影视飓风 · Pocket 4 复刻</div>
            <div className="display" style={{fontSize:30, margin:'2px 0 0', lineHeight:1}}>AI 导演 · 复刻工坊</div>
          </div>
          <div style={{flex:1}}/>
          <span className="chip"><span className="chip-dot"/>5 收藏帧 · 3 版本 · 4 生成结果</span>
        </div>

        {/* Tabs */}
        <div style={{display:'flex', gap:0, marginTop:14, marginBottom:-1}}>
          {TABS.map(t => {
            const Ic = t.ic;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      style={{
                        background:'transparent', border:'none', cursor:'pointer',
                        padding:'10px 18px 14px', display:'flex', alignItems:'center', gap:8,
                        borderBottom: isActive ? '2px solid var(--ink)' : '2px solid transparent',
                        color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                        fontSize:13, fontWeight: isActive ? 600 : 500,
                        marginBottom:-1,
                      }}>
                <Ic size={15}/>
                {t.label}
                <span className="mono" style={{fontSize:10, opacity:0.6, fontWeight:400, letterSpacing:'0.06em'}}>
                  {t.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab body */}
      <div style={{flex:1, minHeight:0, overflow:'hidden'}}>
        {tab === 'kit'     && <FavoritesKit/>}
        {tab === 'prompt'  && <PromptTree/>}
        {tab === 'compare' && <Compare/>}
        {tab === 'dna'     && <StyleDNA/>}
        {tab === 'chat'    && <DirectorChat/>}
      </div>
    </div>
  );
};

window.Director = Director;
})();
