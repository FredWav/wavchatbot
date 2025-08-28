'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };
type ApiOk = { response: string; conversationId: string; metadata?: any };
type ApiErr = { error: string; message?: string };

const ACCENT = '#7c3aed';
const BG_DARK = '#0b0f1a';
const CARD = 'rgba(18,24,38,0.75)';

function genId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function getOrCreateUserId(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  const name = 'fw_user_id';
  const fromCookie = document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1];
  if (fromCookie) return fromCookie;
  const id = genId();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toUTCString();
  document.cookie = `${name}=${id}; path=/; expires=${expires}; SameSite=Lax`;
  try { localStorage.setItem(name, id); } catch {}
  return id;
}

export default function Page() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
    if (typeof document !== 'undefined') {
      document.body.style.margin = '0';
      document.body.style.background = `radial-gradient(1200px 700px at 20% 0%, rgba(124,58,237,0.18), rgba(0,0,0,0)), radial-gradient(1200px 700px at 80% 30%, rgba(14,165,233,0.12), rgba(0,0,0,0))`;
      document.body.style.backgroundColor = BG_DARK;
      document.body.style.color = '#e5e7eb';
      document.body.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    }
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, thinking]);

  async function send() {
    if (!input.trim() || sending || !userId) return;
    const userText = input.trim();
    setInput('');
    setErr(null);
    setMsgs((m) => [...m, { role: 'user', content: userText }]);
    setSending(true);
    setThinking(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          conversationId,
          userId,
          history: msgs.slice(-16),
        }),
      });
      if (!res.ok) {
        let detail = `Erreur technique (${res.status}).`;
        try { const j = (await res.json()) as ApiErr; if (j?.message) detail = j.message; } catch {}
        setErr(detail);
        setMsgs((m) => [...m, { role: 'assistant', content: 'Désolé, une erreur est survenue.' }]);
        return;
      }
      const data = (await res.json()) as ApiOk;
      setConversationId((id) => id ?? data.conversationId);
      setMsgs((m) => [...m, { role: 'assistant', content: data.response }]);
    } catch {
      setErr('Réseau ou API indisponible.');
      setMsgs((m) => [...m, { role: 'assistant', content: 'API indisponible. Réessaie.' }]);
    } finally {
      setThinking(false);
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  /** Loader circulaire responsive (12 branches + anneau) */
  function Spinner() {
    const spokes = new Array(12).fill(null).map((_, i) => {
      const angle = i * 30;
      return (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 'var(--spoke-w)',
            height: 'var(--spoke-h)',
            marginLeft: 'calc(var(--spoke-w) / -2)',
            marginTop: 'calc(var(--spoke-h) / -2)',
            borderRadius: 4,
            background: '#ffffff',
            transformOrigin: '50% calc(var(--spoke-h) - 6px)',
            transform: `rotate(${angle}deg) translateY(var(--spoke-translate))`,
            opacity: 0.22,
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.25))',
            animation: 'fw-spoke 1.05s linear infinite',
            animationDelay: `${-(i / 12)}s`,
            willChange: 'opacity',
          }}
        />
      );
    });
    return (
      <div className="fw-spinner-wrap">
        <div className="fw-spinner-ring" />
        {spokes}
      </div>
    );
  }

  return (
    <div className="fw-root">
      {/* Styles globaux + responsive */}
      <style>{`
        :root{
          --container-max: 980px;
          --pad-x: 12px;
          --pad-y: 14px;
          --bubble-max: 78%;
          --bubble-radius: 12px;
          --font: 15px;
          --spinner-size: 44px;
          --spoke-w: 6px;
          --spoke-h: 20px;
          --spoke-translate: -12px;
          --input-pad: 12px;
          --footer-pad-b: calc(12px + env(safe-area-inset-bottom, 0));
        }
        @media (max-width: 1024px){
          :root{
            --container-max: 820px;
            --bubble-max: 84%;
            --spinner-size: 40px;
            --spoke-h: 18px;
            --spoke-translate: -10px;
          }
        }
        @media (max-width: 768px){
          :root{
            --container-max: 680px;
            --bubble-max: 90%;
            --font: 14.5px;
            --spinner-size: 38px;
            --spoke-w: 5px;
            --spoke-h: 16px;
            --spoke-translate: -9px;
            --input-pad: 10px;
          }
        }
        @media (max-width: 480px){
          :root{
            --container-max: 100%;
            --pad-x: 8px;
            --pad-y: 10px;
            --bubble-max: 94%;
            --spinner-size: 36px;
            --spoke-h: 15px;
            --spoke-translate: -8px;
            --input-pad: 9px;
          }
        }

        .fw-root{
          min-height: 100dvh;
          display: grid;
          grid-template-rows: auto 1fr auto;
        }

        .fw-header{
          position: sticky; top: 0; z-index: 10;
          display:flex; align-items:center; justify-content:center;
          padding: var(--pad-y) var(--pad-x);
          backdrop-filter: saturate(140%) blur(10px);
        }
        .fw-row{ width:100%; max-width: var(--container-max); display:flex; align-items:center; justify-content:space-between; gap:12px; }

        .fw-logo{ width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg, ${ACCENT}, #22d3ee); box-shadow:0 0 0 2px rgba(124,58,237,0.35); }
        .fw-badge{ font-size:12px; padding:6px 10px; border-radius:999px; border:1px solid rgba(124,58,237,0.5); background:rgba(124,58,237,0.12); color:#e9d5ff; white-space:nowrap; }

        .fw-main{ display:flex; justify-content:center; padding: 8px var(--pad-x) 0; }
        .fw-panel{ width:100%; max-width:var(--container-max); background:${CARD}; border:1px solid rgba(148,163,184,0.12); border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.35); display:grid; grid-template-rows: 1fr auto; overflow:hidden; }

        .fw-list{ padding:14px; padding-bottom:0; overflow-y:auto; max-height: calc(100dvh - 200px); display:flex; flex-direction:column; gap:8px; align-content:start; }
        @media (max-width:768px){ .fw-list{ max-height: calc(100dvh - 190px);} }
        @media (max-width:480px){ .fw-list{ max-height: calc(100dvh - 180px);} }

        .fw-intro{ opacity:.9; font-size:14px; line-height:1.28; background:rgba(30,41,59,0.6); border:1px dashed rgba(148,163,184,0.25); padding:10px 12px; border-radius:10px; }

        .fw-msg{ max-width: var(--bubble-max); font-size: var(--font); line-height:1.28; letter-spacing: .1px; color:#e5e7eb; padding: 8px 10px; border-radius: var(--bubble-radius); white-space: pre-wrap; }
        .fw-me{ align-self:flex-end; background: linear-gradient(180deg, rgba(124,58,237,0.22), rgba(124,58,237,0.14)); border:1px solid rgba(124,58,237,0.45); }
        .fw-bot{ align-self:flex-start; background: rgba(30,41,59,0.70); border:1px solid rgba(148,163,184,0.18); }

        .fw-loader-bubble{ align-self:flex-start; width: clamp(56px, 8vw, 64px); height: clamp(56px, 8vw, 64px); background: rgba(30,41,59,0.70); border:1px solid rgba(148,163,184,0.18); border-radius: var(--bubble-radius); display:grid; place-items:center; margin-top:2px; }

        .fw-inputbar{ position:sticky; bottom:0; background:linear-gradient(0deg, rgba(11,15,26,0.9), rgba(11,15,26,0.6)); padding: var(--pad-y) var(--pad-x); padding-bottom: var(--footer-pad-b); border-top:1px solid rgba(148,163,184,0.12); }
        .fw-inputgrid{ display:grid; grid-template-columns: 1fr auto; gap:10px; align-items:center; }
        @media (max-width:480px){ .fw-inputgrid{ grid-template-columns: 1fr auto; gap:8px; } }

        .fw-inputwrap{ display:flex; align-items:center; background:rgba(2,6,23,0.6); border:2px solid ${ACCENT}; border-radius:12px; padding: var(--input-pad) 10px; box-shadow:0 0 0 3px rgba(124,58,237,0.12); }
        .fw-input{ flex:1; background:transparent; border:none; outline:none; color:#e5e7eb; font-size: var(--font); line-height:1.28; padding:6px 2px; min-width:0; }

        .fw-send{ padding:12px 16px; border-radius:12px; border:1px solid ${ACCENT}; background:${ACCENT}; color:#fff; font-weight:600; letter-spacing:.2px; box-shadow:0 8px 20px rgba(124,58,237,0.35); cursor:pointer; }
        .fw-send[disabled]{ background:rgba(124,58,237,0.35); cursor:not-allowed; }

        /* Spinner */
        .fw-spinner-wrap{ position:relative; width: var(--spinner-size); height: var(--spinner-size); }
        .fw-spinner-ring{ position:absolute; inset:0; border-radius:50%; background:conic-gradient(from 0deg, rgba(255,255,255,1) 0deg, rgba(255,255,255,0.15) 70deg, rgba(255,255,255,0.15) 360deg); -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px)); animation: fw-rotate .8s linear infinite; opacity:.35; }
        @keyframes fw-rotate { to { transform: rotate(360deg) } }
        @keyframes fw-spoke { 0% {opacity:1} 50% {opacity:.25} 100% {opacity:.22} }
      `}</style>

      {/* HEADER */}
      <header className="fw-header">
        <div className="fw-row">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="fw-logo" />
            <div style={{ lineHeight:1 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Fred Wav (assistant)</div>
            </div>
          </div>
          <div className="fw-badge">✅ Certifié Wav Anti-Bullshit</div>
        </div>
      </header>

      {/* CHAT */}
      <main className="fw-main">
        <div className="fw-panel">
          <div ref={listRef} className="fw-list">
            {msgs.length === 0 && (
              <div className="fw-intro">
                Je suis <b>Fred Wav (assistant)</b>, le double IA de Fred Wav.
                <br/>Comment puis-je t’aider aujourd’hui ?
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                className={`fw-msg ${m.role === 'user' ? 'fw-me' : 'fw-bot'}`}
              >
                {m.content}
              </div>
            ))}

            {thinking && (
              <div aria-label="Assistant en train de répondre" className="fw-loader-bubble">
                <Spinner />
              </div>
            )}
          </div>

          {/* Barre d’input */}
          <div className="fw-inputbar">
            {err && (
              <div style={{ color:'#fecaca', background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.35)', padding:'8px 10px', borderRadius:10, marginBottom:8, fontSize:13 }}>
                {err}
              </div>
            )}
            <div className="fw-inputgrid">
              <div className="fw-inputwrap">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Écris ici… (Entrée pour envoyer)"
                  className="fw-input"
                />
              </div>
              <button
                onClick={() => {
                  const el = document.activeElement as HTMLInputElement | null;
                  if (el && el.tagName === 'INPUT') el.blur();
                  (async () => { await send(); })();
                }}
                disabled={sending || !input.trim() || !userId}
                className="fw-send"
                aria-label="Envoyer"
                title="Envoyer (Entrée)"
              >
                {sending ? '…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ display:'flex', justifyContent:'center', padding:'8px var(--pad-x) 16px', opacity:.5, fontSize:12 }}>
        <div style={{ width:'100%', maxWidth:'var(--container-max)' }}>
          © {new Date().getFullYear()} Fred Wav — Assistant IA
        </div>
      </footer>
    </div>
  );
}
