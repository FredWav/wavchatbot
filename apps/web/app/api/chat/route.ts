// apps/web/app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type ChatBody = {
  message: string;
  conversationId?: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function dbReady(admin: ReturnType<typeof createClient>) {
  try {
    const { error } = await admin.from("conversations").select("id").limit(1);
    if (error) return false; // table absente / schéma pas en cache
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;
    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "message manquant" },
        { status: 400 }
      );
    }

    // 1) Vérifie la DB (sans planter si tables absentes)
    const haveSupabase =
      !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE;
    const admin = haveSupabase ? getAdmin() : null;
    const isReady = admin ? await dbReady(admin) : false;

    // 2) Crée/resolve conversationId même si pas de DB
    const conversationId =
      body.conversationId || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`);

    // 3) Si DB prête, journalise (sinon on skip proprement)
    if (admin && isReady) {
      // upsert conversation
      await admin.from("conversations").upsert(
        [{ id: conversationId, created_at: new Date().toISOString() }],
        { onConflict: "id" }
      );

      // insère message utilisateur
      await admin.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: body.message,
        created_at: new Date().toISOString(),
      });
    }

    // 4) Appel OpenAI — réponse minimale mais stable
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un assistant clair et concret." },
        { role: "user", content: body.message },
      ],
      temperature: 0.4,
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Je n’ai pas pu générer de réponse.";

    if (admin && isReady) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: text,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      response: text,
      conversationId,
      metadata: { sources: 0, movable: false, contradiction: false },
    });
  } catch (err: any) {
    // Si la DB n’est pas initialisée, renvoie une erreur claire mais non bloquante
    const msg = String(err?.message || err);
    const isSchema =
      msg.includes("PGRST205") ||
      msg.includes("schema cache") ||
      msg.includes("relation") ||
      msg.includes("does not exist");

    if (isSchema) {
      return NextResponse.json(
        {
          error: "DB_NOT_INITIALIZED",
          message:
            "Base non initialisée. Exécute db/schema.sql puis db/rls.sql sur Supabase, puis relance.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Erreur interne" },
      { status: 500 }
    );
  }
}
