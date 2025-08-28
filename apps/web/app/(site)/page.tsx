'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };
type ApiOk = { response: string; conversationId: string; metadata?: any };
type ApiErr = { error: string; message?: string };

const ACCENT = '#7c3aed'; // violet accent
const BG_DARK = '#0b0f1a'; // fond sombre
const CARD = 'rgba(18,24,38,0.75)'; // “verre” sombre

function genId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateUserId(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  const name = 'fw_user_id';
  const fromCookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(name + '='))
    ?.split('=')[1];
  if (fromCookie) return fromCookie;

  const id = genId();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toUTCString();
  document.cookie = `${name}=${id}; path=/; expires=${expires}; SameSite=Lax`;
  try {
    localStorage.setItem(name, id);
  } catch {}
  return id;
}

export default function Page() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>(''); // rempli côté client
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
    // style body simple (pas de dépendance CSS globale)
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
  }, [msgs.length]);

  async function send() {
    if (!input.trim() || sending || !userId) return;
    const userText = input.trim();
    setInput('');
    setErr(null);
    setMsgs((m) => [...m, { role: 'user', content: userText }]);
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userText, conversationId, userId }),
      });

      if (!res.ok) {
        let detail = `Erreur technique (${res.status}).`;
        try {
          const j = (await res.json()) as ApiErr;
          if (j?.message) detail = j.message;
        } catch {}
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
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
      }}
    >
      {/* HEADER — plus clean, sans Conv/UID */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 12px',
          backdropFilter: 'saturate(140%) blur(10px)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 980,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${ACCENT}, #22d3ee)`,
                boxShadow: `0 0 0 2px rgba(124,58,237,0.35)`,
              }}
            />
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Fred Wav (assistant)</div>
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>Double IA — focus concret & ROI</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid rgba(124,58,237,0.5)',
              background: 'rgba(124,58,237,0.12)',
              color: '#e9d5ff',
              whiteSpace: 'nowrap',
            }}
          >
            ✅ Certifié Wav Anti-Bullshit
          </div>
        </div>
      </header>

      {/* CHAT CARD */}
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 12px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 980,
            background: CARD,
            border: '1px solid rgba(148,163,184,0.12)',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            display: 'grid',
            gridTemplateRows: '1fr',
            overflow: 'hidden',
          }}
        >
          {/* Messages */}
          <div
            ref={listRef}
            style={{
              padding: 14,
              paddingBottom: 0,
              overflowY: 'auto',
              maxHeight: 'calc(100dvh - 180px)',
              display: 'grid',
              gap: 8, // moins d’espace vertical
            }}
          >
            {msgs.length === 0 && (
              <div
                style={{
                  opacity: 0.85,
                  fontSize: 14,
                  lineHeight: 1.35,
                  background: 'rgba(30,41,59,0.6)',
                  border: '1px dashed rgba(148,163,184,0.25)',
                  padding: '10px 12px',
                  borderRadius: 10,
                }}
              >
                Je suis <b>Fred Wav (assistant)</b>, ton double IA. Dis-moi ce qui bloque, je te sors un plan concret.
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  justifySelf: m.role === 'user' ? 'end' : 'start',
                  maxWidth: '78%',
                  background:
                    m.role === 'user'
                      ? 'linear-gradient(180deg, rgba(124,58,237,0.22), rgba(124,58,237,0.14))'
                      : 'rgba(30,41,59,0.70)',
                  border:
                    m.role === 'user'
                      ? '1px solid rgba(124,58,237,0.45)'
                      : '1px solid rgba(148,163,184,0.18)',
                  borderRadius: 12,
                  padding: '9px 11px',
                  color: '#e5e7eb',
                  fontSize: 15,
                  lineHeight: 1.35, // compact
                  letterSpacing: '0.1px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            ))}
          </div>

          {/* Barre d’input — plus visible */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background:
                'linear-gradient(0deg, rgba(11,15,26,0.9), rgba(11,15,26,0.6))',
              padding: 12,
              borderTop: '1px solid rgba(148,163,184,0.12)',
            }}
          >
            {err && (
              <div
                style={{
                  color: '#fecaca',
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  padding: '8px 10px',
                  borderRadius: 10,
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(2,6,23,0.6)',
                  border: `2px solid ${ACCENT}`,
                  borderRadius: 12,
                  padding: '6px 10px',
                  boxShadow: `0 0 0 3px rgba(124,58,237,0.12)`,
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Écris ici… (Entrée pour envoyer)"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#e5e7eb',
                    fontSize: 15,
                    lineHeight: 1.3,
                    padding: '6px 2px',
                  }}
                />
              </div>

              <button
                onClick={() => {
                  // focus enter-friendly
                  const el = document.activeElement as HTMLInputElement | null;
                  if (el && el.tagName === 'INPUT') el.blur();
                  // send
                  (async () => {
                    await send();
                  })();
                }}
                disabled={sending || !input.trim() || !userId}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: `1px solid ${ACCENT}`,
                  background: sending || !input.trim() || !userId ? 'rgba(124,58,237,0.35)' : ACCENT,
                  color: 'white',
                  fontWeight: 600,
                  cursor: sending || !input.trim() || !userId ? 'not-allowed' : 'pointer',
                  boxShadow: `0 8px 20px rgba(124,58,237,0.35)`,
                  letterSpacing: '0.2px',
                }}
                aria-label="Envoyer"
                title="Envoyer (Entrée)"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER MINIMAL */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 12px 16px',
          opacity: 0.5,
          fontSize: 12,
        }}
      >
        <div style={{ width: '100%', maxWidth: 980 }}>
          © {new Date().getFullYear()} Fred Wav — Assistant IA
        </div>
      </footer>
    </div>
  );
}
