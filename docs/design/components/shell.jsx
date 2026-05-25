/* Shell — Sidebar + Topbar + Tasks drawer + Tweaks. Matches styles.css class names. */

const Sidebar = ({ route, setRoute }) => {
  const items = [
    { id:'home',       ic: IcHome,    label:'工作台' },
    { id:'taskboard',  ic: IcLayers,  label:'任务中心' },
    { id:'process',    ic: IcSpark,   label:'处理中' , dot: true },
    { id:'results',    ic: IcClap,    label:'结果' },
    { id:'storyboard', ic: IcFilm,    label:'分镜' },
    { id:'library',    ic: IcLibrary, label:'资料库' },
    { id:'director',   ic: IcWand,    label:'AI 导演' },
    { id:'overview',   ic: IcGrid,    label:'12 屏概览' },
  ];
  return (
    <nav className="sidebar">
      <button className="logo-slot" onClick={() => setRoute('home')} title="VidMirror">
        <LogoMark size={28}/>
      </button>
      {items.map(it => (
        <button key={it.id} className="sb-btn" data-active={route === it.id}
                title={it.label} onClick={() => setRoute(it.id)}>
          <it.ic size={20}/>
          {it.dot && route !== it.id && <span className="sb-dot"/>}
        </button>
      ))}
      <div className="sb-sep"/>
      <button className="sb-btn" title="跨工作空间检索" data-active={route==='search'} onClick={() => setRoute('search')}>
        <IcSearch size={20}/>
      </button>
      <div className="sb-spacer"/>
      <button className="sb-btn" title="设置" data-active={route==='settings'} onClick={() => setRoute('settings')}>
        <IcSettings size={20}/>
      </button>
    </nav>
  );
};

const Topbar = ({ route, onOpenTasks, theme, setTheme, onToggleTweaks, tasksCount }) => {
  const crumbs = {
    home:         ['工作台',   'Workbench'],
    taskboard:    ['任务中心', 'Task DB'],
    process:      ['处理中',   'Processing'],
    results:      ['结果',     'Results'],
    storyboard:   ['分镜',     'Storyboard'],
    library:      ['资料库',   'Library'],
    director:     ['AI 导演',  'Director'],
    settings:     ['设置',     'Settings'],
    video_detail: ['视频详情', 'Video Detail'],
    image_detail: ['图片详情', 'Image Detail'],
    audio_detail: ['音频详情', 'Audio Detail'],
    text_detail:  ['文字详情', 'Text Detail'],
    overview:     ['12 屏概览', 'Screen Overview'],
    search:       ['跨工作空间检索', 'Knowledge Search'],
  }[route] || ['工作台', 'Workbench'];

  return (
    <header className="topbar">
      <div className="crumb">
        <strong>{crumbs[0]}</strong>
        <span style={{opacity:0.4}}>·</span>
        <span className="mono" style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em'}}>{crumbs[1]}</span>
      </div>
      <span className="chip"><span className="chip-dot"/>后端 127.0.0.1:8010 · online</span>
      <span className="chip"><span className="chip-dot amber"/>GPU 4090 · 71%</span>
      <div className="spacer"/>
      <button className="btn btn-ghost" title="Language"><IcGlobe size={16}/>中 / EN</button>
      <button className="btn btn-ghost" onClick={() => setTheme(theme==='light'?'dark':'light')} title="Theme">
        {theme==='light' ? <IcMoon size={16}/> : <IcSun size={16}/>}
      </button>
      <button className="btn" onClick={onOpenTasks}>
        <IcList size={16}/>
        任务
        <span style={{opacity:0.55, fontFamily:'var(--mono)', fontSize:11}}>{tasksCount}</span>
      </button>
      <button className="btn btn-pop" onClick={onToggleTweaks}>
        <IcSliders size={16}/>
        Tweaks
      </button>
    </header>
  );
};

// ─── Tasks drawer ───
const TasksDrawer = ({ open, onClose, tasks, activeId, onPick }) => {
  const [filter, setFilter] = React.useState(() => (window.ITF_load ? window.ITF_load() : null));
  React.useEffect(() => { if (filter && window.ITF_save) window.ITF_save(filter); }, [filter]);
  // first render guard if item_tags.jsx hasn't loaded yet
  if (!filter && window.ITF_EMPTY) { /* lazy init */ }
  const effFilter = filter || (window.ITF_EMPTY ? window.ITF_EMPTY() : null);

  const matchOf = (t) => {
    if (!window.wsMatchesFilter || !effFilter) return true;
    return window.wsMatchesFilter(VM_DATA.TASK_TAGS?.[t.id], effFilter);
  };
  const visible = tasks.filter(matchOf);
  const total = tasks.length;
  const matches = visible.length;

  return (
    <>
      <div className="drawer-backdrop" data-open={open} onClick={onClose}/>
      <aside className="drawer" data-open={open}>
        <div className="d-head">
          <h3>任务中心</h3>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>

        {/* Phase 3C · workspace tag filter */}
        {window.WorkspaceTagFilter && (
          <div className="d-filter">
            <WorkspaceTagFilter value={effFilter} onChange={setFilter}
              matches={matches} total={total}/>
          </div>
        )}

        <div className="d-body">
          {visible.map(t => {
            const f = VM_DATA.FRAMES[t.thumb % VM_DATA.FRAMES.length];
            return (
              <div key={t.id} className="d-task" data-active={t.id===activeId} onClick={() => onPick(t)}>
                <div className="dt-thumb">
                  <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
                </div>
                <div className="dt-body">
                  <div className="dt-title">{t.title}</div>
                  <div className="dt-meta">
                    <span>{t.src}</span>
                    <span style={{opacity:0.4}}>·</span>
                    <span>{t.type}</span>
                  </div>
                  {window.TaskTagPreview && <TaskTagPreview taskId={t.id} filter={effFilter}/>}
                </div>
                <div className="dt-state" data-s={t.state}>{t.state}</div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="d-empty">
              <div className="d-empty-h">没有匹配的工作空间</div>
              <div className="d-empty-s">当前筛选下,所有工作空间都被排除。</div>
              <button className="btn" onClick={() => setFilter(window.ITF_EMPTY())}>
                <IcX size={13}/> 清除筛选
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

// ─── Tweaks panel ───
const Tweaks = ({ open, onClose, theme, setTheme, density, setDensity, accent, setAccent, layout, setLayout, lang, setLang, recentMode, setRecentMode, modelsConfigured, setModelsConfigured }) => {
  const swatches = [
    { id:'pink',   color:'linear-gradient(135deg,#FF4D7E,#B84CFF,#3C77FB)' },
    { id:'sunset', color:'linear-gradient(135deg,#FFB84C,#FF4D7E)' },
    { id:'lime',   color:'linear-gradient(135deg,#22D39A,#3C77FB)' },
    { id:'mono',   color:'linear-gradient(135deg,#111,#555)' },
    { id:'purple', color:'linear-gradient(135deg,#B84CFF,#3C77FB)' },
  ];
  return (
    <div className="tweaks" data-open={open}>
      <div className="tw-head">
        <h4><IcSliders size={14}/>Tweaks</h4>
        <button className="btn btn-ghost" onClick={onClose} style={{height:28, padding:'0 8px'}}><IcX size={14}/></button>
      </div>
      <div className="tw-body">
        <div className="tw-row">
          <label>Theme</label>
          <div className="tw-segm">
            <button data-active={theme==='light'} onClick={() => setTheme('light')}>Light</button>
            <button data-active={theme==='dark'} onClick={() => setTheme('dark')}>Dark</button>
          </div>
        </div>
        <div className="tw-row">
          <label>Language</label>
          <div className="tw-segm">
            <button data-active={lang==='zh'} onClick={() => setLang('zh')}>中文</button>
            <button data-active={lang==='bi'} onClick={() => setLang('bi')}>双语</button>
            <button data-active={lang==='en'} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
        <div className="tw-row">
          <label>Density</label>
          <div className="tw-segm">
            <button data-active={density==='compact'} onClick={() => setDensity('compact')}>Compact</button>
            <button data-active={density==='cozy'} onClick={() => setDensity('cozy')}>Cozy</button>
            <button data-active={density==='roomy'} onClick={() => setDensity('roomy')}>Roomy</button>
          </div>
        </div>
        <div className="tw-row">
          <label>Accent</label>
          <div className="tw-swatches">
            {swatches.map(s => (
              <div key={s.id} className="tw-sw" style={{background:s.color}}
                   data-active={accent===s.id} onClick={() => setAccent(s.id)}/>
            ))}
          </div>
        </div>
        <div className="tw-row">
          <label>Results Layout</label>
          <div className="tw-segm">
            <button data-active={layout==='split'} onClick={() => setLayout('split')}>Split</button>
            <button data-active={layout==='stack'} onClick={() => setLayout('stack')}>Stack</button>
          </div>
        </div>
        {setRecentMode && (
          <div className="tw-row">
            <label>首页近期区</label>
            <div className="tw-segm">
              <button data-active={recentMode==='workspaces'} onClick={() => setRecentMode('workspaces')}>工作空间</button>
              <button data-active={recentMode==='tasks'} onClick={() => setRecentMode('tasks')}>任务</button>
            </div>
          </div>
        )}
        <div className="tw-row">
          <label>Typography Scale</label>
          <div className="tw-segm">
            <button data-active={false}>S</button>
            <button data-active={true}>M</button>
            <button data-active={false}>L</button>
          </div>
        </div>
        {/* §13 异常模拟 — 让设计师可触发未配置模型的拦截弹窗 */}
        {setModelsConfigured && (
          <div className="tw-row" style={{ borderTop:'1px dashed var(--line)', paddingTop:14, marginTop:6 }}>
            <label>§13 模型已配置</label>
            <div className="tw-segm">
              <button data-active={modelsConfigured===true}  onClick={() => setModelsConfigured(true)}>已配置</button>
              <button data-active={modelsConfigured===false} onClick={() => setModelsConfigured(false)}>未配置</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar, TasksDrawer, Tweaks });
