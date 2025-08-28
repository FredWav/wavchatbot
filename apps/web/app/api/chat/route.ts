// Chat API route - Main conversation endpoint
import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { classifyMessage } from '@/lib/moderation'
import { shouldSayIDK, composeRefusal, stripInjections, isMovableTopic } from '@/lib/guardrails'
import { retrieveContext } from '@/lib/rag'
import { SYSTEM_PROMPT } from '@/lib/persona'
import { supabase } from '@/config/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Helper function to resolve user ID
async function resolveUserId(request: NextRequest): Promise<string> {
  // In a real implementation, this would extract from JWT token
  // For now, use a simple approach with session/cookie
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const forwarded = request.headers.get('x-forwarded-for') || 'unknown'
  
  // Create a deterministic but pseudo-anonymous user ID
  const hash = Buffer.from(`${userAgent}-${forwarded}`).toString('base64').slice(0, 8)
  return `web_${hash}`
}

// Helper function to get or create conversation
async function getOrCreateConversation(userId: string): Promise<string> {
  try {
    // Try to get the most recent conversation for this user
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (conversations && conversations.length > 0) {
      return conversations[0].id
    }

    // Create a new conversation
    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Conversation avec Fred Wav'
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating conversation:', error)
      throw error
    }

    return newConversation.id
  } catch (error) {
    console.error('Error managing conversation:', error)
    throw error
  }
}

// Helper function to save message
async function saveMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, any> = {}
) {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        metadata
      })

    if (error) {
      console.error('Error saving message:', error)
    }
  } catch (error) {
    console.error('Error saving message:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationId: providedConversationId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // Resolve user ID
    const userId = await resolveUserId(request)

    // Get or create conversation
    const conversationId = providedConversationId || await getOrCreateConversation(userId)

    // PHASE 1: Pre-moderation
    const moderationResult = await classifyMessage(message)
    
    // N3 Refusal: High severity issues (illegal, hate, violence, etc.)
    if (moderationResult.flagged && moderationResult.severity === 'high') {
      const refusalMessage = composeRefusal(moderationResult.reason, 'N3')
      
      await saveMessage(conversationId, userId, 'user', message)
      await saveMessage(conversationId, userId, 'assistant', refusalMessage, {
        refusal_reason: moderationResult.reason,
        moderation_categories: moderationResult.categories
      })

      return NextResponse.json({
        response: refusalMessage,
        conversationId,
        metadata: {
          refusal: true,
          severity: 'N3',
          reason: moderationResult.reason
        }
      })
    }

    // Clean the message
    const cleanMessage = stripInjections(message)

    // Check if topic is movable (prices, algorithms, laws, updates)
    const movable = isMovableTopic(cleanMessage)

    // PHASE 2: RAG Context Retrieval
    const { hits, contradiction } = await retrieveContext(cleanMessage, userId)

    // PHASE 3: Wav Anti-Bullshit Heuristic
    if (shouldSayIDK(hits, movable, contradiction)) {
      let refusalSeverity: 'N1' | 'N2' | 'N3' = 'N1'
      let category = 'information manquante'

      if (contradiction) {
        refusalSeverity = 'N3'
        category = 'contradictions détectées'
      } else if (movable && hits.length < 2) {
        refusalSeverity = 'N2'
        category = 'sujet mouvant'
      }

      const refusalMessage = composeRefusal(category, refusalSeverity)

      await saveMessage(conversationId, userId, 'user', cleanMessage)
      await saveMessage(conversationId, userId, 'assistant', refusalMessage, {
        refusal_reason: category,
        hits_count: hits.length,
        movable,
        contradiction,
        wav_anti_bullshit: true
      })

      return NextResponse.json({
        response: refusalMessage,
        conversationId,
        metadata: {
          refusal: true,
          severity: refusalSeverity,
          reason: category,
          hits_count: hits.length,
          movable,
          contradiction
        }
      })
    }

    // PHASE 4: Generate LLM Response
    // Prepare context from RAG hits
    const contextText = hits.length > 0 
      ? hits.map(hit => `[Source: ${hit.document_title}]\n${hit.content}`).join('\n\n')
      : ''

    const contextPrompt = contextText 
      ? `\n\nCONTEXTE VÉRIFIÉ :\n${contextText}\n\nUtilise UNIQUEMENT ces informations vérifiées pour répondre.`
      : '\n\nAucun contexte spécifique trouvé. Réponds selon ton expertise générale mais mentionne tes limites.'

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + contextPrompt },
      { role: 'user', content: cleanMessage }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    let response = completion.choices[0].message.content || 'Désolé, je n\'ai pas pu générer de réponse.'

    // PHASE 5: Post-moderation
    const responseModeration = await classifyMessage(response)
    
    if (responseModeration.flagged) {
      response = composeRefusal('réponse générée inappropriée', 'N2')
    }

    // Add Fred Wav signature and next steps
    const finalResponse = `${response}

---
✅ **Certifié Wav Anti-Bullshit** — jamais d'invention, toujours vérifiable

**🎯 Prochaine étape :** ${hits.length > 0 && movable 
  ? 'Teste ces conseils en petit et reviens me dire tes résultats !' 
  : 'Passe à l\'action et reviens si tu as des questions spécifiques !'}`

    // Save messages
    await saveMessage(conversationId, userId, 'user', cleanMessage)
    await saveMessage(conversationId, userId, 'assistant', finalResponse, {
      sources: hits.map(hit => ({
        title: hit.document_title,
        authority: hit.document_authority,
        similarity: hit.similarity
      })),
      movable,
      contradiction,
      tokens_used: completion.usage?.total_tokens,
      model: 'gpt-4'
    })

    return NextResponse.json({
      response: finalResponse,
      conversationId,
      metadata: {
        sources: hits.length,
        movable,
        contradiction,
        tokens_used: completion.usage?.total_tokens
      }
    })

  } catch (error) {
    console.error('Chat API error:', error)
    
    return NextResponse.json({
      response: "Désolé, une erreur technique est survenue. L'équipe Fred Wav a été notifiée.",
      error: 'Internal server error'
    }, { status: 500 })
  }
}