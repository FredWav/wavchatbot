import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type ChatBody = {
  message: string;
  conversationId?: string;
  userId?: string; // requis par ton schema.sql
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;

    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "message manquant" },
        { status: 400 }
      );
    }
    if (!body?.userId || typeof body.userId !== "string") {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "userId manquant" },
        { status: 400 }
      );
    }

    const conversationId =
      body.conversationId ||
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

    const admin = getAdmin();
    const isReady = admin ? await dbReady(admin) : false;

    // Journalisation si DB prête
    if (admin && isReady) {
      await admin.from("conversations").upsert(
        [
          {
            id: conversationId,
            user_id: body.userId,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: "id" }
      );

      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "user",
        content: body.message,
        created_at: new Date().toISOString(),
      });
    }

    // Réponse OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "Tu es un assistant clair et concret." },
        { role: "user", content: body.message },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Je n’ai pas pu générer de réponse.";

    if (admin && isReady) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
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
    const msg = String(err?.message || err);
    const schemaErr =
      msg.includes("PGRST205") ||
      msg.includes("schema cache") ||
      msg.includes("relation") ||
      msg.includes("does not exist");

    if (schemaErr) {
      return NextResponse.json(
        {
          error: "DB_NOT_INITIALIZED",
          message:
            "Base non initialisée. Exécute db/schema.sql puis db/rls.sql dans Supabase.",
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
