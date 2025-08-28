// Moderation API route
import { NextRequest, NextResponse } from 'next/server'
import { classifyMessage } from '@/lib/moderation'
import { stripInjections } from '@/lib/guardrails'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // Strip potential injections before processing
    const cleanMessage = stripInjections(message)
    
    // Classify the message
    const moderationResult = await classifyMessage(cleanMessage)

    return NextResponse.json({
      flagged: moderationResult.flagged,
      categories: moderationResult.categories,
      severity: moderationResult.severity,
      reason: moderationResult.reason,
      cleanMessage
    })

  } catch (error) {
    console.error('Moderation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}