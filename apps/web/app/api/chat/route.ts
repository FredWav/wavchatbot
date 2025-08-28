// apps/web/app/api/chat/route.ts
// API-first + GPT-5 (Responses API). On envoie toujours l'historique (DB + client)
// pour que le modèle sache que ce n'est PAS le premier tour → pas de "Salut" en boucle.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "../../../lib/persona";

type Msg = { role: "user" | "assistant" | "system"; content: string };

type ChatBody = {
  message: string;
  conversationId?: string;
  userId?: string;
  history?: Msg[]; // historique envoyé par le client (fallback si DB non dispo)
};

const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getAdmin(): SupabaseClient | null {
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
    return data
      .map((m) =>
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
        !!m && typeof m.content === "string" &&
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

    const admin = getAdmin();
    const ready = admin ? await dbReady(admin) : false;

    // Upsert conversation AVANT de lire l'historique
    if (admin && ready) {
      await admin.from("conversations").upsert([{ id: conversationId, user_id: body.userId }], { onConflict: "id" });
    }

    // 1) Historique DB (sans le message courant)
    const dbHistory = admin && ready ? await fetchHistory(admin, conversationId) : [];

    // 2) Historique client (fallback) puis fusion/déduplication
    const clientHistory = sanitizeClientHistory(body.history);
    const history = dedupeConcat(dbHistory, clientHistory);

    // 3) Log du message courant côté DB (si dispo)
    if (admin && ready) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "user",
        content: body.message,
      });
    }

    // 4) Appel OpenAI — GPT-5 Responses API
    const response = await oai.responses.create({
      model: "gpt-5",
      instructions: SYSTEM_PROMPT,
      input: [
        ...history,                          // contexte → évite de re-saluer
        { role: "user", content: body.message },
      ],
      temperature: 0.2,
      max_output_tokens: 1400,
      reasoning: { effort: "high" },
      text: { verbosity: "medium" },
    });

    const text = (response as any).output_text?.trim?.() || "Je n’ai pas pu générer de réponse.";

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
      metadata: { model: "gpt-5" },
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
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Erreur interne" }, { status: 500 });
  }
}
