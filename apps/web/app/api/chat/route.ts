// apps/web/app/api/chat/route.ts
// API-first : tout le comportement est piloté par le prompt système (persona + knowledge).
// Modèle : gpt-5 (puissance max) via Responses API + reasoning HIGH.
// Pas de logique de salut/questions ici : c’est géré par SYSTEM_PROMPT.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "../../../lib/persona";

type ChatBody = {
  message: string;
  conversationId?: string;
  userId?: string;
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

async function fetchHistory(admin: SupabaseClient, conversationId: string) {
  try {
    const { data, error } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(24);
    if (error || !data) return [];
    return data.map((m) =>
      (m.role === "user" || m.role === "assistant" || m.role === "system")
        ? ({ role: m.role, content: m.content } as const)
        : ({ role: "user", content: m.content } as const)
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

    // Persistance (best-effort)
    const admin = getAdmin();
    const ready = admin ? await dbReady(admin) : false;

    if (admin && ready) {
      await admin.from("conversations").upsert([{ id: conversationId, user_id: body.userId }], { onConflict: "id" });
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "user",
        content: body.message,
      });
    }

    // Historique (si dispo)
    const history =
      admin && ready && body.conversationId ? await fetchHistory(admin, conversationId) : [];

    // === OpenAI Responses API (GPT-5) ===
    // - instructions = ton persona/knowledge complet
    // - reasoning effort HIGH pour pousser le raisonnement
    // - text.verbosity pour gérer la longueur (sans injecter de phrases toutes faites)
    const response = await oai.responses.create({
      model: "gpt-5",
      instructions: SYSTEM_PROMPT,
      input: [
        ...history,
        { role: "user", content: body.message },
      ],
      temperature: 0.2,
      max_output_tokens: 1400,
      reasoning: { effort: "high" },      // contrôle de l’effort de raisonnement
      text: { verbosity: "medium" },      // "low" / "medium" / "high"
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
