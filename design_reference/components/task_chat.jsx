/* TaskChat — 任务级 LLM 对话 (§1.3) · 基于任务内所有分析数据跨素材提问 */

/* ── Build system context from all task data ── */
const buildTaskContext = () => {
  const d = window.VM_DATA;
  if (!d) return '';
  const cfg = d.TASK_CONFIG || {};

  const materialsStr = (d.MATERIALS || [])
    .map(m => `  - [${m.type.toUpperCase()}] ${m.title}（${m.source}）标签：${m.tags.join(', ') || '暂无'}`)
    .join('\n');

  const tagsStr = Object.entries(d.TAG_LIB || {})
    .map(([dim, tags]) => `  ${dim}：${tags.map(t => `${t.tag}(×${t.count})`).join(', ')}`)
    .join('\n');

  const favsStr = (d.FAVORITES || [])
    .map(f => `  - ${f.note}｜${f.ts}｜提示词：${f.prompt}`)
    .join('\n');

  const wc = (d.STYLE_REPORT || {}).wordcloud || [];
  const sr = d.STYLE_REPORT || {};

  const latestPrompt = (d.PROMPT_VERSIONS || []).slice(-1)[0] || {};

  const transcriptSample = (d.TRANSCRIPT || []).slice(0, 6)
    .map(l => `  [${l.t}] ${l.text}`)
    .join('\n');

  return `你是 VidMirror 的 AI 创作助手。以下是当前任务的完整分析数据，请基于这些数据回答用户的问题。

## 任务信息
- 任务名称：${cfg.name || '—'}
- 内容类型：${cfg.contentType || '—'}
- 分析目的：${cfg.purpose || '—'}
- 背景：${cfg.background || '—'}
- 专有名词：${cfg.terms || '—'}
- 参与人员：${cfg.people || '—'}

## 素材列表（共 ${(d.MATERIALS || []).length} 个）
${materialsStr}

## 提示词标签库
${tagsStr}

## 收藏帧（复刻清单）
${favsStr}

## 创作者风格报告
- 作者：${sr.author || '—'}
- 惯用词（高频）：${wc.slice(0, 12).map(w => w.w).join('、')}
- 色彩偏好：${(sr.palette || []).join(' · ')}
- 镜头习惯：${JSON.stringify(sr.shots || {})}
- 音乐偏好：BPM ${(sr.music || {}).bpm || '—'}，风格 ${((sr.music || {}).genres || []).join('/')}
- 复刻建议：${(sr.advice || []).join('；')}

## 最新版提示词（迭代记录）
版本：${latestPrompt.v || '—'} · ${latestPrompt.at || '—'}
${latestPrompt.text || '—'}

## 视频转录摘要（前 6 条）
${transcriptSample}

请用中文回答，简洁有力，可以使用列表和表格格式。`;
};

/* ── Suggested prompts ── */
const SUGGESTED = [
  '这批素材的画风提示词有哪些高频词？',
  '帮我整合所有音乐分析，找出共同的风格特征',
  '哪个素材的镜头语言最值得复刻？',
  '把所有收藏帧的提示词整理成一份表格',
  '这批参考素材的色调有什么规律？',
  '根据风格报告，给我生成 3 条复刻建议',
];

/* ── Message bubble ── */
const Bubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start', marginBottom: 14,
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 700,
        background: isUser ? 'var(--ink)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        color: '#fff',
      }}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '78%',
        background: isUser ? 'var(--ink)' : 'var(--bg-elev)',
        color: isUser ? 'var(--bg)' : 'var(--ink)',
        border: isUser ? 'none' : '1px solid var(--line)',
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '11px 14px',
        fontSize: 13, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
        {msg.loading && (
          <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: 99,
                background: 'var(--accent)', display: 'inline-block',
                animation: `tc-blink 1.2s ${i*0.2}s infinite both`,
              }}/>
            ))}
          </span>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TaskChat
   ═══════════════════════════════════════════ */
const TaskChat = () => {
  const [messages, setMessages] = React.useState([
    {
      role: 'assistant',
      content: `你好！我已加载「${(window.VM_DATA?.TASK_CONFIG || {}).name || '当前任务'}」的全部分析数据，包括 ${(window.VM_DATA?.MATERIALS || []).length} 个素材、${Object.values(window.VM_DATA?.TAG_LIB || {}).flat().length} 个提示词标签、${(window.VM_DATA?.FAVORITES || []).length} 个收藏帧。\n\n你可以问我任何跨素材的问题 👇`,
    },
  ]);
  const [input,   setInput]   = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef(null);
  const inputRef  = React.useRef(null);

  /* Scroll to bottom on new message */
  React.useEffect(() => {
    const el = bottomRef.current;
    if (el) el.parentElement.scrollTop = el.offsetTop;
  }, [messages]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg   = { role: 'user',      content: q };
    const loadingMsg = { role: 'assistant', content: '', loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const systemCtx = buildTaskContext();
      const history   = messages.map(m => ({ role: m.role, content: m.content }));
      const response  = await window.claude.complete({
        messages: [
          ...history,
          { role: 'user', content: q },
        ],
        system: systemCtx,
      });
      setMessages(prev => [
        ...prev.slice(0, -1), // remove loading bubble
        { role: 'assistant', content: response },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `⚠️ 请求失败：${err?.message || '未知错误'}。请检查 Claude API 配置。` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const showSuggested = messages.length <= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
                    borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center',
                      background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
          <IcSpark size={16} style={{ color: '#fff' }}/>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>任务级 AI 对话</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            基于 {(window.VM_DATA?.MATERIALS || []).length} 个素材 · {Object.values(window.VM_DATA?.TAG_LIB || {}).flat().length} 个标签 · {(window.VM_DATA?.FAVORITES || []).length} 个收藏帧
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ height: 28, fontSize: 12 }}
                  onClick={() => setMessages([{ role:'assistant', content:'对话已清空。你可以重新开始提问。' }])}>
            <IcX size={13}/> 清空对话
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Suggested prompts (shown only before first user message) */}
        {showSuggested && (
          <div style={{ marginBottom: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>建议提问</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {SUGGESTED.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                        style={{ padding: '7px 13px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                                  border: '1px solid var(--line)', background: 'var(--bg-elev)',
                                  color: 'var(--ink-2)', transition: 'all 140ms',
                                  display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IcArrowRight size={11} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat bubbles */}
        {messages.map((msg, i) => <Bubble key={i} msg={msg}/>)}
        <div ref={bottomRef}/>
      </div>

      {/* ── Input area ── */}
      <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid var(--line)',
                    background: 'var(--bg-elev)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end',
                      background: 'var(--bg-sunken)', border: '1px solid var(--line)',
                      borderRadius: 16, padding: '10px 14px', transition: 'border-color 160ms' }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey} rows={1} disabled={loading}
                    placeholder="问任何跨素材的问题… （Enter 发送，Shift+Enter 换行）"
                    style={{
                      flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink)',
                      maxHeight: 120, overflowY: 'auto',
                    }}/>
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  style={{ width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                            background: input.trim() && !loading ? 'var(--ink)' : 'var(--bg-sunken)',
                            color: input.trim() && !loading ? 'var(--bg)' : 'var(--ink-4)',
                            transition: 'all 160ms' }}>
            <IcSend size={14}/>
          </button>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 6, textAlign: 'center' }}>
          Claude · 已注入任务完整数据库作为上下文 · 仅限本地使用
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes tc-blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

window.TaskChat = TaskChat;
