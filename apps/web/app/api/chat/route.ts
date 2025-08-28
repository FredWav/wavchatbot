// apps/web/app/api/chat/route.ts
// "API first" : aucune logique conversationnelle côté serveur.
// Le persona/knowledge gèrent le salut + 2 questions mini, etc.
// Modèle : gpt-4o (puissance maximale).

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "../../../lib/persona";

type ChatBody = {
  message: string;
  conversationId?: string;
  userId?: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

async function fetchHistory(admin: SupabaseClient, conversationId: string) {
  try {
    const { data, error } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error || !data) return [];
    return data.map((m) =>
      (m.role === "user" || m.role === "assistant" || m.role === "system")
        ? { role: m.role as "user" | "assistant" | "system", content: m.content }
        : { role: "user" as const, content: m.content }
    );
  } catch {
    return [];
  }
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

    // Persistance côté DB (facultative si la DB n'est pas prête)
    if (admin && ready) {
      await admin.from("conversations").upsert([{ id: conversationId, user_id: body.userId }], { onConflict: "id" });
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "user",
        content: body.message,
      });
    }

    // Historique (si disponible) — on laisse l'API gérer le tour 1 (salut + 2 questions)
    const history =
      admin && ready && body.conversationId ? await fetchHistory(admin, conversationId) : [];

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: body.message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",            // <-- puissance
      temperature: 0.2,           // précis
      max_tokens: 900,            // réponses détaillées si besoin
      messages,
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Je n’ai pas pu générer de réponse. Reformule simplement ta demande.";

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
      metadata: { model: "gpt-4o" },
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
