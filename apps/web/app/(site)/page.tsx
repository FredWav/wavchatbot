'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };
type ApiOk = { response: string; conversationId: string; metadata?: any };
type ApiErr = { error: string; message?: string };

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
  const [userId, setUserId] = useState<string>(''); // initial vide côté SSR
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <b>Wav Chatbot</b>
        <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>
          {conversationId ? `Conv: ${conversationId.slice(0, 8)}…` : 'Nouvelle conversation'}
        </span>
        {userId && (
          <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>UID: {userId.slice(0, 8)}…</span>
        )}
      </header>

      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 12 }}
      >
        {msgs.length === 0 && (
          <div style={{ opacity: 0.6 }}>Pose-moi une question (Entrée pour envoyer)…</div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'end' : 'start',
              background: m.role === 'user' ? '#eef6ff' : '#f7f7f8',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: '10px 12px',
              maxWidth: '80%',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
              {m.role === 'user' ? 'Toi' : 'Assistant'}
            </div>
            {m.content}
          </div>
        ))}
      </div>

      {err && (
        <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '8px 12px' }}>{err}</div>
      )}

      <footer
        style={{
          padding: 12,
          borderTop: '1px solid #eee',
          display: 'flex',
          gap: 8,
          background: '#fff',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Écris ton message…"
          style={{
            flex: 1,
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 12px',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim() || !userId}
          style={{
            border: '1px solid #2563eb',
            background: sending || !userId ? '#93c5fd' : '#3b82f6',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 10,
            cursor: sending || !userId ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </footer>
    </div>
  );
}
