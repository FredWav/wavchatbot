// API-first : le comportement vient de SYSTEM_PROMPT (persona + knowledge).
// Modèle : gpt-4.1 (stable). Historique envoyé à chaque appel (DB + client)
// pour éviter les re-salutations et garder le contexte.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "../../../lib/persona";

type Msg = { role: "user" | "assistant" | "system"; content: string };

type ChatBody = {
  message: string;
  conversationId?: string;
  userId?: string;
  history?: Msg[]; // historique côté client (fallback si DB off)
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ---------- Supabase (optionnel) ----------
function getAdmin(): SupabaseClient | null {
  // Mets SUPABASE_ENABLED=0 sur Vercel pour désactiver toute persistance
  const enabled = (process.env.SUPABASE_ENABLED ?? "1").toLowerCase();
  if (enabled === "0" || enabled === "false") return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function dbReady(admin: SupabaseClient) {
  try {
    const { error } = await admin.from("conversations").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function fetchHistory(admin: SupabaseClient, conversationId: string): Promise<Msg[]> {
  try {
    const { data, error } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(40);
    if (error || !data) return [];
    return data.map((m) =>
      (m.role === "user" || m.role === "assistant" || m.role === "system")
        ? ({ role: m.role, content: m.content } as Msg)
        : ({ role: "user", content: m.content } as Msg)
    );
  } catch {
    return [];
  }
}

function sanitizeClientHistory(h?: Msg[]): Msg[] {
  if (!Array.isArray(h)) return [];
  return h
    .filter(
      (m): m is Msg =>
        !!m &&
        typeof m.content === "string" &&
        (m.role === "user" || m.role === "assistant" || m.role === "system")
    )
    .slice(-24);
}

function dedupeConcat(a: Msg[], b: Msg[]): Msg[] {
  const seen = new Set<string>();
  const out: Msg[] = [];
  for (const m of [...a, ...b]) {
    const key = `${m.role}::${m.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out.slice(-24);
}

// ---------- Route handler ----------
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;

    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json({ error: "BAD_REQUEST", message: "message manquant" }, { status: 400 });
    }
    if (!body?.userId || typeof body.userId !== "string") {
      return NextResponse.json({ error: "BAD_REQUEST", message: "userId manquant" }, { status: 400 });
    }

    const conversationId =
      body.conversationId || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

    // Persistance (best-effort)
    const admin = getAdmin();
    const ready = admin ? await dbReady(admin) : false;

    if (admin && ready) {
      await admin.from("conversations").upsert(
        [{ id: conversationId, user_id: body.userId }],
        { onConflict: "id" }
      );
    }

    // Historique (DB + client)
    const dbHistory = admin && ready ? await fetchHistory(admin, conversationId) : [];
    const clientHistory = sanitizeClientHistory(body.history);
    const history = dedupeConcat(dbHistory, clientHistory);

    // Log du message courant
    if (admin && ready) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "user",
        content: body.message,
      });
    }

    // --- OpenAI Chat Completions (gpt-4.1) ---
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: body.message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      max_tokens: 1400,
      messages,
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Je n’ai pas pu générer de réponse.";

    if (admin && ready) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "assistant",
        content: text,
      });
    }

    return NextResponse.json({
      response: text,
      conversationId,
      metadata: { model: "gpt-4.1" },
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const schemaErr =
      msg.includes("PGRST205") || msg.includes("schema cache") || msg.includes("relation") || msg.includes("does not exist");
    if (schemaErr) {
      return NextResponse.json(
        { error: "DB_NOT_INITIALIZED", message: "Base non initialisée. Exécute db/schema.sql puis db/rls.sql dans Supabase." },
        { status: 503 }
      );
    }

    // Erreur OpenAI (ex : mauvais modèle/clé)
    const status = err?.status ?? err?.response?.status;
    if (status) {
      return NextResponse.json(
        { error: "OPENAI_ERROR", message: `OpenAI ${status} — ${msg}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Erreur interne" }, { status: 500 });
  }
}
