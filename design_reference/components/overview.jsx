/* Overview — 12-screen design canvas embedded in VidMirror.
   Reuses ALL existing components; no new visual language.
   Pan/zoom canvas: drag to pan, scroll/pinch to zoom.            */

(() => {

/* ─── Mini frozen snapshot of each screen ─── */
/* We render each screen inside a scaled iframe-like container
   at a fixed artboard size (1280×820), then the canvas scales them. */

const ARTBOARD_W = 1280;
const ARTBOARD_H = 800;

/* Sections */
const SECTIONS = [
  {
    id: 'entry',
    title: '① 入口与任务管理',
    sub: 'Entry & Task Management',
    screens: [
      {
        id: 's01', num:'01', title:'工作台 · Workbench',
        sub:'URL 输入 + 管线配置 + 示例卡',
        tone:'pink',
        render: () => <Workbench onStart={() => {}} />,
      },
      {
        id: 's02', num:'02', title:'任务中心 · Task Board',
        sub:'素材管理 + 标签库 + 收藏 + 报告',
        tone:'pink',
        render: () => <Taskboard onAddMaterial={() => {}} onOpenMaterial={() => {}} />,
      },
      {
        id: 's03', num:'03', title:'处理队列 · Queue',
        sub:'进度列表 + 系统占用 + 滑块',
        tone:'purple',
        render: () => <QueuePanel onOpenMaterial={() => {}} />,
      },
      {
        id: 's04', num:'04', title:'处理中 · Processing',
        sub:'分步动画 + 日志 + 预览帧',
        tone:'purple',
        render: () => <Processing progress={0.55} onDone={() => {}} onCancel={() => {}} />,
      },
    ],
  },
  {
    id: 'results',
    title: '② 四类结果页',
    sub: 'Result Views by Media Type',
    screens: [
      {
        id: 's05', num:'05', title:'结果总览 · Results',
        sub:'摘要 + 时间轴 + 转录 + 分镜入口',
        tone:'blue',
        render: () => <Results layout="stack" onOpenStoryboard={() => {}} />,
      },
      {
        id: 's06', num:'06', title:'视频详情 · Video Detail',
        sub:'播放器 + 三轨 + 提示词面板',
        tone:'blue',
        render: () => <VideoDetail material={VM_DATA.MATERIALS[0]} onBack={() => {}} onAddFavorite={() => {}} />,
      },
      {
        id: 's07', num:'07', title:'音频详情 · Audio Detail',
        sub:'波形 + 多说话人 + 音乐分析',
        tone:'purple',
        render: () => <AudioDetail material={VM_DATA.MATERIALS[3]} onBack={() => {}} />,
      },
      {
        id: 's08', num:'08', title:'图片详情 · Image Detail',
        sub:'左图右信息 + EXIF + AI 任务',
        tone:'blue',
        render: () => <ImageDetail material={VM_DATA.MATERIALS[2]} onBack={() => {}} />,
      },
    ],
  },
  {
    id: 'insight',
    title: '③ 洞察与复刻',
    sub: 'Insight & Remix Kit',
    screens: [
      {
        id: 's09', num:'09', title:'文字详情 · Text Detail',
        sub:'原文 ↔ 金句 + 关键词对照',
        tone:'amber',
        render: () => <TextDetail material={VM_DATA.MATERIALS[6]} onBack={() => {}} />,
      },
      {
        id: 's10', num:'10', title:'分镜 · Storyboard',
        sub:'三套剧本 + 镜头网格',
        tone:'pink',
        render: () => <Storyboard active="A" setActive={() => {}} />,
      },
      {
        id: 's11', num:'11', title:'设置 · Settings',
        sub:'AI 提供商 + 模型 + 存储',
        tone:'amber',
        render: () => <Settings />,
      },
      {
        id: 's12', num:'12', title:'AI 导演 · Director (stub)',
        sub:'复刻 / 风格 / 对比 · 扩展入口',
        tone:'purple',
        render: () => <DirectorStub />,
      },
    ],
  },
];

/* ─── DirectorStub: placeholder for unbuilt screen ─── */
const DirectorStub = () => (
  <div style={{
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 20,
    background: 'var(--bg)', padding: 48,
  }}>
    <div style={{
      width: 80, height: 80, borderRadius: 24,
      background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
      display: 'grid', placeItems: 'center', color: '#fff',
    }}>
      <IcWand size={36}/>
    </div>
    <div style={{ textAlign: 'center', maxWidth: 480 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>AI Director · 即将推出</div>
      <div className="display" style={{ fontSize: 42, margin: '0 0 16px' }}>
        一键<span style={{ color: 'var(--accent)' }}>复刻</span>
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        从收藏帧 → 生成提示词 → 比对结果 → 版本管理<br/>
        跨素材风格报告、A/B 对比、创作者风格 DNA 提炼
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      {['收藏清单', '风格报告', 'A/B 对比', '提示词版本'].map(t => (
        <span key={t} className="tag">{t}</span>
      ))}
    </div>
  </div>
);

/* ─── Artboard: renders a screen at full size inside a scale container ─── */
const Artboard = React.memo(({ screen, scale, focused, onFocus }) => {
  const containerW = Math.round(ARTBOARD_W * scale);
  const containerH = Math.round(ARTBOARD_H * scale);

  const toneColors = {
    pink:   'rgba(255,77,126,0.25)',
    purple: 'rgba(184,76,255,0.25)',
    blue:   'rgba(60,119,251,0.25)',
    amber:  'rgba(255,184,76,0.25)',
  };

  return (
    <div
      onClick={onFocus}
      style={{
        width: containerW, height: containerH,
        borderRadius: 18, overflow: 'hidden',
        border: `1.5px solid ${focused ? 'var(--ink)' : 'var(--line)'}`,
        boxShadow: focused
          ? '0 0 0 3px var(--ink), var(--shadow-lg)'
          : 'var(--shadow-md)',
        cursor: focused ? 'default' : 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'box-shadow 200ms ease, border-color 200ms ease',
        background: 'var(--bg)',
      }}
    >
      {/* Scale inner content */}
      <div style={{
        width: ARTBOARD_W, height: ARTBOARD_H,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        pointerEvents: focused ? 'auto' : 'none',
        userSelect: focused ? 'auto' : 'none',
        overflow: 'hidden',
      }}>
        {screen.render()}
      </div>

      {/* Overlay label when not focused */}
      {!focused && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'transparent',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: 0,
        }}>
          {/* screen number badge */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            width: 32, height: 32, borderRadius: 10,
            background: toneColors[screen.tone],
            backdropFilter: 'blur(6px)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
            color: 'var(--ink)', border: '1px solid var(--line)',
          }}>
            {screen.num}
          </div>
        </div>
      )}
    </div>
  );
});

/* ─── ArtboardLabel ─── */
const ArtboardLabel = ({ screen, scale, focused, onExpand }) => {
  const containerW = Math.round(ARTBOARD_W * scale);
  return (
    <div style={{
      width: containerW,
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 8, padding: '10px 2px 0',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)' }}>
          {screen.title}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.08em' }}>
          {screen.sub}
        </div>
      </div>
      {!focused && (
        <button
          className="btn"
          style={{ height: 28, padding: '0 10px', fontSize: 11, flexShrink: 0 }}
          onClick={onExpand}
        >
          <IcArrowRight size={12}/>
          展开
        </button>
      )}
    </div>
  );
};

/* ─── Section header ─── */
const SectionHeader = ({ section }) => (
  <div style={{
    padding: '0 0 20px',
    borderBottom: '1px solid var(--line)',
    marginBottom: 32,
  }}>
    <div className="eyebrow" style={{ marginBottom: 6 }}>{section.sub}</div>
    <div className="display" style={{ fontSize: 40, margin: 0, letterSpacing: '-0.02em' }}>
      {section.title}
    </div>
  </div>
);

/* ─── Overview canvas: pan + zoom ─── */
const OverviewCanvas = ({ setRoute }) => {
  const [zoom, setZoom] = React.useState(0.38);
  const [pan, setPan] = React.useState({ x: 48, y: 48 });
  const [dragging, setDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState(null);
  const [focusedId, setFocusedId] = React.useState(null);
  const canvasRef = React.useRef();

  const MIN_ZOOM = 0.18;
  const MAX_ZOOM = 1.0;
  const ZOOM_STEP = 0.06;

  /* Wheel zoom */
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
      } else {
        setPan(p => ({ x: p.x - e.deltaX * 0.6, y: p.y - e.deltaY * 0.6 }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (!dragging || !dragStart) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => { setDragging(false); setDragStart(null); };

  const handleFocus = (id) => setFocusedId(id === focusedId ? null : id);

  /* Navigate to actual route on expand */
  const routeMap = {
    s01: 'home', s02: 'taskboard', s03: 'queue', s04: 'process',
    s05: 'results', s06: 'taskboard', s07: 'taskboard', s08: 'taskboard',
    s09: 'taskboard', s10: 'storyboard', s11: 'settings', s12: 'director',
  };

  const focusedZoom = Math.min(MAX_ZOOM, 0.72);

  const handleExpand = (id) => {
    const r = routeMap[id];
    if (r) setRoute(r);
  };

  /* ─── Render ─── */
  const SECTION_GAP = 80;
  const CARD_GAP = 28;

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: 'var(--bg-sunken)' }}>
      {/* Controls bar */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'var(--bg-elev)', border: '1px solid var(--line)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <button className="btn btn-ghost" style={{ height: 34, padding: '0 10px', borderRadius: 0 }}
                  onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))}>+</button>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)',
            padding: '0 8px', borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)',
            minWidth: 52, textAlign: 'center', lineHeight: '34px',
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn btn-ghost" style={{ height: 34, padding: '0 10px', borderRadius: 0 }}
                  onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))}>−</button>
        </div>
        <button className="btn" style={{ height: 34 }}
                onClick={() => { setZoom(0.38); setPan({ x: 48, y: 48 }); setFocusedId(null); }}>
          重置
        </button>
        {focusedId && (
          <button className="btn btn-primary" style={{ height: 34 }}
                  onClick={() => handleExpand(focusedId)}>
            <IcArrowRight size={14}/>
            进入
          </button>
        )}
      </div>

      {/* Dot grid background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.35 }}>
        <defs>
          <pattern id="dot-grid" x={pan.x % 32} y={pan.y % 32} width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--ink-4)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)"/>
      </svg>

      {/* Scrollable canvas */}
      <div
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{
          position: 'absolute',
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: '0 0',
          padding: 0,
        }}>
          {SECTIONS.map((section, si) => {
            // Calculate top offset for this section
            const sectionTop = SECTIONS.slice(0, si).reduce((acc) => acc + ARTBOARD_H * zoom + 80 + 32 + 4 * 16 + SECTION_GAP, 0);

            return (
              <div key={section.id} style={{
                marginBottom: SECTION_GAP,
                width: (ARTBOARD_W * zoom * 4) + (CARD_GAP * 3),
              }}>
                {/* Section title */}
                <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>{section.sub}</div>
                  <div className="display" style={{ fontSize: 36, margin: 0, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                    {section.title}
                  </div>
                </div>

                {/* Cards row */}
                <div style={{ display: 'flex', gap: CARD_GAP, alignItems: 'flex-start' }}>
                  {section.screens.map(screen => {
                    const isFocused = focusedId === screen.id;
                    const effectiveZoom = isFocused ? focusedZoom : zoom;

                    return (
                      <div key={screen.id} style={{ flexShrink: 0 }}>
                        <Artboard
                          screen={screen}
                          scale={effectiveZoom}
                          focused={isFocused}
                          onFocus={() => handleFocus(screen.id)}
                        />
                        <ArtboardLabel
                          screen={screen}
                          scale={effectiveZoom}
                          focused={isFocused}
                          onExpand={() => handleExpand(screen.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* End padding */}
          <div style={{ height: 80 }}/>
        </div>
      </div>
    </div>
  );
};

window.OverviewCanvas = OverviewCanvas;
})();
