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
      .limit(16);
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

    const isNewConversation = !body.conversationId;
    const conversationId =
      body.conversationId ||
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

    const admin = getAdmin();
    const ready = admin ? await dbReady(admin) : false;

    // Log côté DB (si prête)
    if (admin && ready) {
      await admin.from("conversations").upsert(
        [{ id: conversationId, user_id: body.userId }],
        { onConflict: "id" }
      );
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: body.userId,
        role: "user",
        content: body.message,
      });
    }

    // EXIGENCE : premier tour -> poser 2 questions MIN (niche + objectif/KPI+délai), rien d'autre
    if (isNewConversation) {
      const starter = [
        "Pour bien t’aider, j’ai besoin de deux infos rapides :",
        "1) Ta niche / ton profil précis ?",
        "2) Ton objectif principal (KPI + délai) ?",
      ].join("\n");

      if (admin && ready) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          user_id: body.userId,
          role: "assistant",
          content: starter,
        });
      }

      return NextResponse.json({
        response: starter,
        conversationId,
        metadata: { mode: "onboarding" },
      });
    }

    // Tours suivants : réponse spécifique sans plan par défaut (le persona gère tout le reste)
    const history =
      admin && ready && body.conversationId
        ? await fetchHistory(admin, conversationId)
        : [];

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: body.message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages,
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Précise ta niche et ton objectif (KPI + délai).";

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
      metadata: { mode: "answer" },
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
