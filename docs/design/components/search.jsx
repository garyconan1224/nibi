/* Phase 3B — 跨工作空间知识库检索
 *
 *  SearchGlobal      : /search 全局检索页 (Hero composer + 综合回答 + 来源列表)
 *  WorkspaceSearchBar: 嵌入 WorkspaceDetail 顶部的窄版检索栏 (本工作空间内, 内联展开结果)
 *
 *  视觉延用现有 token: --bg-elev / --line / --accent* / Instrument Serif / JetBrains Mono
 *  类型徽章配色沿用 Taskboard: video=pink, audio=purple, image=blue, text=amber
 */

const KS_TYPE_TONE  = { video:'pink', audio:'purple', image:'blue', text:'amber' };
const KS_TYPE_LABEL = { video:'视频', audio:'音频', image:'图片', text:'文字' };
const KS_TYPE_ICON  = { video: IcFilm, audio: IcMusic, image: IcImage, text: IcDoc };

/* ─── inline markdown renderer: [N] cite + **bold** ─── */
const renderKsInline = (text, onCite) => {
  const parts = text.split(/(\[\d+\]|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    let m;
    if ((m = p.match(/^\[(\d+)\]$/))) {
      const n = parseInt(m[1], 10);
      return <KsCite key={i} n={n} onClick={() => onCite(n)} />;
    }
    if ((m = p.match(/^\*\*(.+)\*\*$/))) return <strong key={i}>{m[1]}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

const KsCite = ({ n, onClick }) => (
  <button className="ks-cite" onClick={onClick} title={`来源 [${n}]`}>{n}</button>
);

/* ─── 范围下拉 (scope picker) ─── */
const KsScope = ({ scope, setScope, workspaces }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const totalItems = workspaces.reduce((s, w) => s + w.items, 0);
  const current = scope === 'all'
    ? { name:'全部工作空间', n: totalItems }
    : (() => { const w = workspaces.find(w => w.id === scope); return { name: w?.name || '—', n: w?.items || 0 }; })();
  return (
    <div className="ks-scope" ref={ref}>
      <button className="ks-scope-btn" onClick={() => setOpen(o => !o)}>
        <IcLayers size={13}/>
        <span className="ks-scope-name">{current.name}</span>
        <span className="ks-scope-n mono">{current.n}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{opacity:0.5}}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="ks-scope-menu">
          <button className="ks-scope-opt" data-active={scope==='all'} onClick={() => { setScope('all'); setOpen(false); }}>
            <IcGrid size={13}/>
            <span>全部工作空间</span>
            <span className="ks-scope-n mono">{totalItems}</span>
          </button>
          <div className="ks-scope-sep"/>
          {workspaces.map(w => (
            <button key={w.id} className="ks-scope-opt" data-active={scope===w.id}
                    onClick={() => { setScope(w.id); setOpen(false); }}>
              <span className="ks-scope-dot" data-current={w.active?'true':'false'}/>
              <span>{w.name}</span>
              <span className="ks-scope-n mono">{w.items}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── 加载中状态 (语义召回 + LLM 综合) ─── */
const KsExecuting = ({ stage, candidates }) => {
  const stages = [
    { id:0, label:'向量召回 · 6 工作空间 · 41 素材', ok: stage >= 1 },
    { id:1, label:`重排序 · 取 top ${candidates || 23}`, ok: stage >= 2 },
    { id:2, label:'LLM 综合回答中', ok: stage >= 3 },
  ];
  return (
    <div className="ks-exec">
      {stages.map((s, i) => (
        <div key={s.id} className="ks-exec-row" data-state={s.ok ? 'done' : (i === stage ? 'running' : 'queued')}>
          <div className="ks-exec-ic">
            {s.ok ? <IcCheck size={12}/> : (i === stage ? <span className="spinner" style={{width:12,height:12,borderWidth:1.5}}/> : <span className="ks-exec-dot"/>)}
          </div>
          <span className="ks-exec-label">{s.label}</span>
          {i === stage && !s.ok && (
            <span className="proc-dots mono ks-exec-dots"><span>·</span><span>·</span><span>·</span></span>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─── 来源卡片 ─── */
const KsSourceCard = ({ s, flashId }) => {
  const Ic = KS_TYPE_ICON[s.item_type] || IcDoc;
  const tone = KS_TYPE_TONE[s.item_type] || 'amber';
  const frame = VM_DATA.FRAMES[s.thumb % VM_DATA.FRAMES.length];
  const isFlash = flashId === s.idx;
  return (
    <div className="ks-src" id={`ks-src-${s.idx}`} data-flash={isFlash}>
      <div className="ks-src-idx">{s.idx}</div>
      <div className="ks-src-thumb">
        <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`} alt=""/>
        <span className="ks-src-type" data-tone={tone}><Ic size={10}/>{KS_TYPE_LABEL[s.item_type]}</span>
      </div>
      <div className="ks-src-body">
        <div className="ks-src-ws">
          <IcLayers size={11}/>
          <span className="ks-src-ws-name">{s.workspace_name}</span>
          <span className="ks-src-slash">/</span>
          <span className="mono ks-src-item">{s.item_id}</span>
          {s.ts && <>
            <span className="ks-src-slash">·</span>
            <span className="mono ks-src-ts">{s.ts}</span>
          </>}
        </div>
        <div className="ks-src-title">{s.item_title}</div>
        <div className="ks-src-excerpt">
          <span className="ks-src-quote">“</span>{s.chunk_excerpt}<span className="ks-src-quote">”</span>
        </div>
      </div>
      <div className="ks-src-meta">
        <div className="ks-src-score">
          <div className="ks-score-num mono">{s.score.toFixed(3)}</div>
          <div className="ks-score-label mono">SCORE</div>
          <div className="ks-score-bar"><span style={{width:`${Math.round(s.score*100)}%`}}/></div>
        </div>
        <button className="btn ks-src-jump" title="跳转到来源">
          <span>跳转</span>
          <IcArrowRight size={12}/>
        </button>
      </div>
    </div>
  );
};

/* ─── 全局检索页 (/search) ─── */
const SearchGlobal = ({ initialQuery }) => {
  const demo = VM_DATA.SEARCH_DEMO;
  const workspaces = VM_DATA.SEARCH_WORKSPACES;
  const recent = VM_DATA.SEARCH_RECENT;

  const [q, setQ] = React.useState(initialQuery || '');
  const [scope, setScope] = React.useState('all');
  const [phase, setPhase] = React.useState('idle');   // idle | exec | done
  const [execStage, setExecStage] = React.useState(0);
  const [flashId, setFlashId] = React.useState(null);
  const inputRef = React.useRef(null);
  const sourcesRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const text = q.trim();
    if (!text) return;
    setPhase('exec');
    setExecStage(0);
    const t1 = setTimeout(() => setExecStage(1), 280);
    const t2 = setTimeout(() => setExecStage(2), 620);
    const t3 = setTimeout(() => { setExecStage(3); setPhase('done'); }, 1100);
    // cleanup not strictly needed; component lives till unmount
  };

  const onCite = (n) => {
    const target = document.getElementById(`ks-src-${n}`);
    const scroller = document.querySelector('.main-scroll');
    if (target && scroller) {
      const r = target.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      scroller.scrollTo({ top: scroller.scrollTop + r.top - sr.top - 80, behavior: 'smooth' });
      setFlashId(n);
      setTimeout(() => setFlashId(null), 1500);
    }
  };

  const sources = scope === 'all' ? demo.sources : demo.sources.filter(s => s.workspace_id === scope);

  return (
    <div className="ks-wrap">
      {/* ─── Hero ─── */}
      <div className="ks-hero">
        <div className="eyebrow ks-eyebrow">
          <span>KNOWLEDGE BASE · 跨工作空间检索</span>
          <span className="ks-eyebrow-tag">PHASE 3B</span>
        </div>
        <h1 className="display ks-h1">
          一次提问,
          <em className="ks-accent">{scope === 'all' ? '所有工作空间' : '当前工作空间'}</em>
          一起回答。
        </h1>
        <p className="ks-lede">
          把所有素材的转写 · 提示词 · 摘要当作个人语料库。语义召回相关 chunk, 文本大模型综合回答, 每条都附原素材跳转。
        </p>

        {/* Composer */}
        <div className="ks-composer" data-state={phase}>
          <div className="ks-input-row">
            <div className="ks-input-ic"><IcSearch size={20}/></div>
            <input
              ref={inputRef}
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="提一个问题, 比如:产品开箱视频的前 5 秒都用了什么手法?"
              spellCheck={false}
            />
            {q && (
              <button className="ks-clear" onClick={() => { setQ(''); setPhase('idle'); inputRef.current?.focus(); }} title="清空">
                <IcX size={14}/>
              </button>
            )}
            <KsScope scope={scope} setScope={setScope} workspaces={workspaces}/>
          </div>
          <div className="ks-foot">
            <div className="ks-foot-l">
              <span className="kbd-key">↵</span>
              <span className="ks-foot-hint">提交 · 语义检索 + LLM 综合</span>
              <span className="ks-foot-dot">·</span>
              <span className="ks-foot-hint mono">embed-3 large · sonnet</span>
            </div>
            <button className="btn-run" onClick={submit} disabled={!q.trim()}>
              <span>{phase === 'exec' ? '搜索中' : '搜索'}</span>
              <span className="iconwrap"><IcArrowRight size={14}/></span>
            </button>
          </div>
        </div>

        {/* Recent queries (idle 时显示) */}
        {phase === 'idle' && recent && recent.length > 0 && (
          <div className="ks-recent">
            <span className="eyebrow ks-recent-label">RECENT · 最近搜索</span>
            <div className="ks-recent-chips">
              {recent.map((rq, i) => (
                <button key={i} className="ks-recent-chip" onClick={() => { setQ(rq); setTimeout(submit, 50); }}>
                  <IcClock size={11}/>
                  <span>{rq}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Executing ─── */}
      {phase === 'exec' && (
        <div className="ks-section ks-exec-wrap">
          <KsExecuting stage={execStage} candidates={demo.candidates_recalled}/>
        </div>
      )}

      {/* ─── Done: Answer + Sources ─── */}
      {phase === 'done' && (
        <>
          {/* Answer card */}
          <section className="ks-section">
            <div className="ks-section-head">
              <div className="ks-section-hd-l">
                <div className="eyebrow">ANSWER · 综合回答</div>
                <h2 className="display ks-section-title">{q}</h2>
              </div>
              <div className="ks-section-hd-r">
                <span className="chip"><span className="chip-dot"/>{demo.duration}</span>
                <span className="chip mono">{sources.length} 引用</span>
              </div>
            </div>
            <div className="ks-answer-card">
              <div className="ks-answer-body md-body">
                {demo.answer_blocks.map((b, i) => {
                  if (b.type === 'h3')         return <h3 key={i}>{renderKsInline(b.text, onCite)}</h3>;
                  if (b.type === 'blockquote') return <blockquote key={i}>{renderKsInline(b.text, onCite)}</blockquote>;
                  if (b.type === 'ul')         return <ul key={i}>{(b.items||[]).map((li, j) => <li key={j}>{renderKsInline(li, onCite)}</li>)}</ul>;
                  return <p key={i}>{renderKsInline(b.text, onCite)}</p>;
                })}
              </div>
              <div className="ks-answer-foot">
                <div className="ks-answer-foot-l">
                  <span className="mono ks-answer-model">claude-sonnet-4 · 312 tokens</span>
                </div>
                <div className="ks-answer-foot-r">
                  <button className="btn btn-ghost"><IcDownload size={13}/>复制</button>
                  <button className="btn btn-ghost">导出为 .md</button>
                  <button className="btn btn-ghost">不准确</button>
                </div>
              </div>
            </div>

            {/* Suggested followups */}
            {demo.suggested_followups && (
              <div className="ks-followups">
                <span className="eyebrow ks-followup-label">FOLLOW UP · 继续问</span>
                <div className="ks-followup-list">
                  {demo.suggested_followups.map((f, i) => (
                    <button key={i} className="ks-followup" onClick={() => { setQ(f); setTimeout(submit, 50); }}>
                      <span>{f}</span>
                      <IcArrowRight size={12}/>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Sources */}
          <section className="ks-section" ref={sourcesRef}>
            <div className="ks-section-head">
              <div className="ks-section-hd-l">
                <div className="eyebrow">SOURCES · 来源</div>
                <h2 className="display ks-section-title" style={{fontSize:32}}>
                  {sources.length} 个匹配 chunk
                </h2>
              </div>
              <div className="ks-section-hd-r">
                <button className="btn btn-ghost"><IcSliders size={13}/>按类型筛选</button>
                <button className="btn btn-ghost"><IcDownload size={13}/>导出全部</button>
              </div>
            </div>
            <div className="ks-src-list">
              {sources.map(s => <KsSourceCard key={s.idx} s={s} flashId={flashId}/>)}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

/* ─── 工作空间内嵌检索栏 ─── */
const WorkspaceSearchBar = ({ workspaceName = '本工作空间' }) => {
  const demo = VM_DATA.SEARCH_WORKSPACE_DEMO;
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState('idle'); // idle | exec | done
  const submit = () => {
    if (!q.trim()) return;
    setOpen(true);
    setPhase('exec');
    setTimeout(() => setPhase('done'), 650);
  };
  const clear = () => { setQ(''); setOpen(false); setPhase('idle'); };
  const sources = demo.sources;

  return (
    <div className="ws-search" data-open={open}>
      <div className="ws-search-bar">
        <div className="ws-search-ic"><IcSearch size={16}/></div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') clear(); }}
          placeholder={`在「${workspaceName}」内检索 — 转写 · 提示词 · 摘要 · 金句`}
          spellCheck={false}
        />
        <span className="ws-search-scope mono"><IcLayers size={11}/>本工作空间</span>
        {q && <button className="ws-search-clear" onClick={clear} title="清空"><IcX size={13}/></button>}
        <button className="btn btn-primary ws-search-go" onClick={submit} disabled={!q.trim()}>
          <span>搜索</span>
        </button>
      </div>

      {open && (
        <div className="ws-search-panel">
          {phase === 'exec' && (
            <div className="ws-search-exec">
              <span className="spinner" style={{width:14,height:14,borderWidth:1.5,color:'var(--ink-3)'}}/>
              <span className="mono">语义召回中 · 8 素材</span>
            </div>
          )}
          {phase === 'done' && (
            <>
              <div className="ws-search-summary">
                <span className="eyebrow">RESULTS</span>
                <span className="mono">{sources.length} 个 chunk · {demo.duration}</span>
                <div className="ws-search-summary-spacer"/>
                <button className="btn btn-ghost" onClick={clear}><IcX size={12}/>收起</button>
              </div>
              <div className="ws-search-results">
                {sources.map(s => {
                  const Ic = KS_TYPE_ICON[s.item_type] || IcDoc;
                  return (
                    <div key={s.idx} className="ws-result">
                      <div className="ws-result-l">
                        <span className="ws-result-type" data-tone={KS_TYPE_TONE[s.item_type]}>
                          <Ic size={10}/>{KS_TYPE_LABEL[s.item_type]}
                        </span>
                        <span className="mono ws-result-ts">{s.ts}</span>
                      </div>
                      <div className="ws-result-body">
                        <div className="ws-result-title">{s.item_title}</div>
                        <div className="ws-result-excerpt">{s.chunk_excerpt}</div>
                      </div>
                      <div className="ws-result-r">
                        <span className="mono ws-result-score">{s.score.toFixed(3)}</span>
                        <button className="btn btn-ghost ws-result-jump"><IcArrowRight size={12}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ws-search-cta">
                <span style={{fontSize:13, color:'var(--ink-3)'}}>没找到? 在全部工作空间里再问一遍——</span>
                <button className="btn">
                  <IcLayers size={13}/>跨工作空间检索
                  <IcArrowRight size={12}/>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { SearchGlobal, WorkspaceSearchBar });
