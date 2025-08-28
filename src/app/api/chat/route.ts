import { NextRequest, NextResponse } from 'next/server';
import { shouldRefuseAnswer, getRandomIdkResponse } from '@/lib/anti-bullshit';

interface ChatRequest {
  message: string;
}

// Simulated RAG quality check
function simulateRAGCheck(query: string): { hasReliableSources: boolean; confidence: number } {
  // In a real implementation, this would check against a vector database
  // For now, we simulate based on query complexity and common knowledge
  const queryLength = query.length;
  const hasSpecificTerms = /prix|date|nouveau|récent|latest|2024|2025/i.test(query);
  
  if (hasSpecificTerms) {
    return { hasReliableSources: false, confidence: 0.1 };
  }
  
  if (queryLength < 10) {
    return { hasReliableSources: false, confidence: 0.2 };
  }
  
  // Simulate reliable sources for general questions
  return { hasReliableSources: true, confidence: 0.8 };
}

// Basic chatbot responses for demonstration
function generateBasicResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut')) {
    return "Bonjour ! Je suis l'assistant WAV Anti-Bullshit. Comment puis-je vous aider de manière fiable aujourd'hui ?";
  }
  
  if (lowerMessage.includes('merci')) {
    return "De rien ! N'hésitez pas si vous avez d'autres questions. Je préfère toujours dire 'Je ne sais pas' plutôt que de donner de fausses informations.";
  }
  
  if (lowerMessage.includes('comment ça marche') || lowerMessage.includes('comment tu')) {
    return "Je fonctionne selon le principe WAV Anti-Bullshit : je ne remplis jamais les trous d'information. Si je n'ai pas de source fiable ou si l'information pourrait être inexacte, je dis 'Je ne sais pas'.";
  }
  
  // Default response for general queries
  return "Je peux vous aider avec des informations générales, mais je dois d'abord vérifier si j'ai des sources fiables pour votre question. Si ce n'est pas le cas, je préférerai vous dire 'Je ne sais pas'.";
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // First, check anti-bullshit rules
    const refusalCheck = shouldRefuseAnswer(message);
    if (refusalCheck.refuse) {
      return NextResponse.json({
        response: refusalCheck.response,
        refused: true,
        reason: refusalCheck.reason
      });
    }

    // Simulate RAG quality check
    const ragCheck = simulateRAGCheck(message);
    
    // If no reliable sources, return IDK response
    if (!ragCheck.hasReliableSources || ragCheck.confidence < 0.25) {
      return NextResponse.json({
        response: `${getRandomIdkResponse()} Je n'ai pas suffisamment de sources fiables pour répondre à cette question.`,
        refused: true,
        reason: 'insufficient_sources'
      });
    }

    // Generate response (in a real app, this would use LLM with RAG)
    const response = generateBasicResponse(message);

    return NextResponse.json({
      response,
      refused: false,
      confidence: ragCheck.confidence
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      response: "Je ne sais pas - une erreur technique s'est produite.",
      refused: true,
      reason: 'technical_error'
    });
  }
}