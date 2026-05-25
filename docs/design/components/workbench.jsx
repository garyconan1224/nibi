/* Workbench (Home) — slim composer that mirrors nibi/frontend/src/pages/WorkbenchPage.
   v3 — 2026-05-25
   Diff vs v2.2 (kept in workbench_v1.jsx):
   - Removed: 画质/抽帧 row, 4 列 LLM 配置 grid, Pipeline pills, "预计 4 min" meta
     (these now live in AddMaterialModal + PreflightDrawer, matching real product)
   - Removed: Mixed-content modal, in-workbench Preflight (lifted to App level)
   - Single Run button: "添加素材" → opens AddMaterialModal at App level via onAddMaterial
   - Workspace empty-state text aligned to real product: "未选空间 · 提交时自动创建"
   - Backend host hint aligned to 127.0.0.1:8000 + green live dot
   - New Tweak: recentMode ∈ {workspaces, tasks} — switches the Recent section between
     the rich WorkspaceCard grid (mockup-flavored) and the朴素 ex-card grid (real-product
     flavored), so we can A/B decide which to keep. */

const Workbench = ({ onAddMaterial, onOpenWorkspace, onSeeAllWorkspaces, onOpenMaterial, recentMode='workspaces' }) => {
  const [url, setUrl] = React.useState('');
  const [projectSel, setProjectSel] = React.useState([]); // workspace ids — empty = unassigned
  const [projectOpen, setProjectOpen] = React.useState(false);
  const [projectQuery, setProjectQuery] = React.useState('');

  // 项目 = 工作空间 (SEARCH_WORKSPACES). Color is derived deterministically by index.
  const WS_COLORS = ['#22c55e','#f59e0b','#a855f7','#0ea5e9','#ef4444','#ec4899','#14b8a6','#eab308'];
  const [wsExtra, setWsExtra] = React.useState([]); // newly-created in-session
  const baseWs = (window.VM_DATA && window.VM_DATA.SEARCH_WORKSPACES) || [];
  const projects = React.useMemo(() => (
    [...baseWs, ...wsExtra].map((w, i) => ({
      id: w.id, name: w.name, count: w.items, color: w.color || WS_COLORS[i % WS_COLORS.length],
      active: w.active,
    }))
  ), [baseWs, wsExtra]);
  const projectsById = React.useMemo(() => Object.fromEntries(projects.map(p=>[p.id,p])), [projects]);
  const filteredProjects = React.useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, projectQuery]);
  const toggleProject = (id) => setProjectSel(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const removeProject = (id) => setProjectSel(s => s.filter(x=>x!==id));

  const popRef = React.useRef(null);
  React.useEffect(() => {
    if (!projectOpen) return;
    const onClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setProjectOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [projectOpen]);

  /* Light platform-detection for the input chip (purely cosmetic — real backend will sniff). */
  const PLATFORMS = {
    'bilibili.com':  { name:'Bilibili',  color:'#00A1D6', types:['video'] },
    'youtube.com':   { name:'YouTube',   color:'#FF0000', types:['video'] },
    'youtu.be':      { name:'YouTube',   color:'#FF0000', types:['video'] },
    'douyin.com':    { name:'抖音',      color:'#010101', types:['video'] },
    'xiaohongshu.com':{ name:'小红书',   color:'#FF2442', types:['video','image','article'] },
    'kuaishou.com':  { name:'快手',      color:'#FF6600', types:['video'] },
    'weixin.qq.com': { name:'微信公众号', color:'#07C160', types:['article'] },
  };
  const detected = (() => {
    try { const h = new URL(url).hostname.replace('www.',''); return Object.entries(PLATFORMS).find(([k]) => h.includes(k)); } catch { return null; }
  })();
  const platform = detected ? detected[1] : null;

  const handleAdd = () => {
    if (!url.trim()) return;
    onAddMaterial && onAddMaterial({ url, workspaceIds: projectSel });
  };

  /* ─── Recent section data ─── */
  const tasks = (window.VM_DATA && window.VM_DATA.TASKS) || [];
  const STATE_COLOR = {
    done:      'var(--accent-green, #22c55e)',
    running:   'var(--accent-blue, #3C77FB)',
    error:     'var(--accent-pink, #FF4D7E)',
    cancelled: 'var(--ink-3)',
    queued:    'var(--ink-4)',
  };
  const TYPE_ICON = { video: IcFilm, audio: IcMic, image: IcImage, text: IcDoc };

  return (
    <>
      {/* ─── Hero + Composer ─── */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="hb-pill">v0.3 BETA</span>
          VidMirror · <span className="mono" style={{fontSize:11}}>127.0.0.1:8000</span>
          <span style={{width:6,height:6,borderRadius:99,background:'var(--accent-green,#22c55e)',
                        boxShadow:'0 0 0 3px rgba(34,197,94,0.15)'}}/>
          本地版 · 无文件大小限制
        </div>
        <h1 className="display">
          把任意内容,变成<br/>
          <span className="accent-pink">可复刻</span>的<span className="accent-purple">创作蓝图</span>。
        </h1>
        <p className="lede">
          粘贴 B站 / YouTube / 小红书 / 抖音链接,或上传本地视频·图片·音频·文字 —— VidMirror 自动识别类型,
          调用 AI 分析并提取画面提示词、字幕、风格参数,归入任务数据库。
        </p>

        <div className="composer">
          {/* URL row */}
          <div className="composer-url">
            {platform ? (
              <div className="platform" style={{background: platform.color, color:'#fff', fontSize:10, fontWeight:700, letterSpacing:'0.04em', width:'auto', padding:'0 10px'}}>
                {platform.name}
              </div>
            ) : (
              <div className="platform"><IcLink size={18}/></div>
            )}
            <input value={url} onChange={e=>setUrl(e.target.value)}
                   placeholder="粘贴 B站 / YouTube / 小红书 / 抖音 / 本地文件路径..."/>
            {platform && (
              <div style={{display:'flex', gap:4, flexShrink:0}}>
                {platform.types.map(t => (
                  <span key={t} className="kw" style={{background:'var(--bg-sunken)', fontSize:11}}>{t}</span>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" title="上传本地文件"><IcUpload size={16}/>上传</button>
          </div>

          {/* Workspace assignment row */}
          <div className="composer-projects">
            <span className="pp-label">归入工作空间</span>
            {projectSel.length === 0 && (
              <span className="pp-none">未选空间 · 提交时自动创建</span>
            )}
            {projectSel.map(id => {
              const p = projectsById[id]; if (!p) return null;
              return (
                <span key={id} className="pp-chip">
                  <span className="pp-dot" style={{background:p.color}}/>
                  {p.name}
                  <button className="pp-x" onClick={()=>removeProject(id)} title="移除"><IcX size={11}/></button>
                </span>
              );
            })}
            <button className="pp-add" onClick={()=>setProjectOpen(o=>!o)}>
              <IcLayers size={11}/>{projectSel.length ? '继续添加' : '选择工作空间'}
            </button>
            <span style={{marginLeft:'auto', fontSize:10, color:'var(--ink-4)', fontFamily:'var(--mono)'}}
              title="一个内容可同时归入多个工作空间">
              可多选 · 一个内容可归入多个空间
            </span>

            {projectOpen && (
              <div className="pp-popover" ref={popRef}>
                <div className="pp-search">
                  <IcSearch size={14}/>
                  <input autoFocus placeholder="搜索工作空间..."
                    value={projectQuery} onChange={e=>setProjectQuery(e.target.value)}/>
                  {projectSel.length>0 && (
                    <button className="btn btn-ghost" onClick={()=>setProjectSel([])}
                      style={{height:24, padding:'0 8px', fontSize:11}}>清空</button>
                  )}
                </div>
                <div className="pp-list">
                  {filteredProjects.length === 0 && (
                    <div style={{padding:'18px 12px', textAlign:'center', fontSize:12, color:'var(--ink-4)', fontFamily:'var(--mono)'}}>
                      无匹配工作空间
                    </div>
                  )}
                  {filteredProjects.map(p => {
                    const on = projectSel.includes(p.id);
                    return (
                      <div key={p.id} className="pp-row" data-on={on}
                           onClick={()=>toggleProject(p.id)}>
                        <span className="pp-check"><IcCheck size={11} strokeWidth={3}/></span>
                        <span className="pp-dot" style={{width:8, height:8, borderRadius:99, background:p.color}}/>
                        <div style={{minWidth:0}}>
                          <div className="pp-name">{p.name}{p.active && <span style={{marginLeft:6, fontSize:9, color:'var(--accent-green, var(--ink-3))', fontFamily:'var(--mono)', letterSpacing:'0.06em'}}>• 当前</span>}</div>
                        </div>
                        <span className="pp-count">{p.count} 项</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pp-foot">
                  <button className="pp-new"
                    onClick={()=>{
                      const name = projectQuery.trim() || '新工作空间';
                      const id = 'ws-'+Date.now().toString(36);
                      const color = WS_COLORS[(baseWs.length + wsExtra.length) % WS_COLORS.length];
                      setWsExtra(prev => [...prev, { id, name, items: 0, color }]);
                      setProjectSel(s => [...s, id]);
                      setProjectQuery('');
                    }}>
                    <IcPlus size={11}/>新建工作空间{projectQuery ? ` "${projectQuery}"` : ''}
                  </button>
                  <button className="pp-done" onClick={()=>setProjectOpen(false)}>完成</button>
                </div>
              </div>
            )}
          </div>

          {/* Run row — slim, matches real product (single 添加素材 button) */}
          <div className="composer-run" style={{justifyContent:'flex-end'}}>
            <button className="btn-run" onClick={handleAdd}
                    disabled={!url.trim()}
                    style={{opacity: url.trim() ? 1 : 0.45, cursor: url.trim() ? 'pointer' : 'not-allowed'}}>
              添加素材
              <span className="iconwrap"><IcArrowRight size={14}/></span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── Recent section — switchable via Tweaks ─── */}
      <section className="examples">
        <div className="examples-head">
          <h2 className="display" style={{margin:0, fontSize:36}}>
            {recentMode === 'tasks' ? '最近任务' : '最近工作空间'}
          </h2>
          <button className="btn btn-ghost" onClick={onSeeAllWorkspaces}>
            全部 · {tasks.length} <IcArrowRight size={14}/>
          </button>
        </div>

        {recentMode === 'tasks' ? (
          /* Real-product style: 朴素 ex-card with state pill on monochrome thumb */
          <div className="ex-grid" style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',
            gap:14,
          }}>
            {tasks.slice(0, 8).map(t => {
              const Icon = TYPE_ICON[t.type] || IcFilm;
              const state = t.state || 'done';
              return (
                <div key={t.id} className="ex-card"
                  onClick={() => onOpenMaterial && onOpenMaterial(t)}
                  style={{borderRadius:12, background:'var(--bg-elev)', border:'1px solid var(--line)',
                          overflow:'hidden', cursor:'pointer', transition:'transform 160ms, box-shadow 160ms'}}>
                  <div style={{aspectRatio:'16/9', background:'#111', position:'relative',
                               display:'grid', placeItems:'center', color:'rgba(255,255,255,0.4)'}}>
                    <Icon size={28}/>
                    <div style={{position:'absolute', top:8, left:8, display:'inline-flex',
                                 alignItems:'center', gap:5, padding:'3px 8px', borderRadius:99,
                                 background:'rgba(0,0,0,0.65)', fontSize:10, color:'#fff', fontFamily:'var(--mono)'}}>
                      <span style={{width:5, height:5, borderRadius:99, background:STATE_COLOR[state], flexShrink:0}}/>
                      {state}
                    </div>
                  </div>
                  <div style={{padding:'12px 14px'}}>
                    <div style={{fontSize:13, fontWeight:500, lineHeight:1.3, marginBottom:4, color:'var(--ink)',
                                 overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {t.title || t.name || t.id}
                    </div>
                    <div style={{fontFamily:'var(--mono)', fontSize:10.5, color:'var(--ink-3)',
                                 letterSpacing:'0.08em'}}>
                      {t.src || t.platform || 'local'} · {t.type || 'video'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Mockup-flavored: rich WorkspaceCard grid (kept per user request) */
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
            gap:14,
          }}>
            {tasks.slice(0, 6).map(t => (
              <WorkspaceCard key={t.id} task={t} compact onOpen={onOpenWorkspace}/>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

window.Workbench = Workbench;
