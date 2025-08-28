// Moderation utilities and API integration
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export interface ModerationCategory {
  hate: boolean
  violence: boolean
  illegal: boolean
  harassment: boolean
  sexual: boolean
  finance: boolean
  vague: boolean
  injection: boolean
  uncertain: boolean
}

export interface ModerationResult {
  flagged: boolean
  categories: ModerationCategory
  severity: 'low' | 'medium' | 'high'
  reason: string
}

/**
 * Classify a message using OpenAI's moderation API + custom rules
 */
export async function classifyMessage(message: string): Promise<ModerationResult> {
  const result: ModerationResult = {
    flagged: false,
    categories: {
      hate: false,
      violence: false,
      illegal: false,
      harassment: false,
      sexual: false,
      finance: false,
      vague: false,
      injection: false,
      uncertain: false
    },
    severity: 'low',
    reason: ''
  }

  try {
    // OpenAI moderation API for standard categories
    const moderation = await openai.moderations.create({
      input: message
    })

    const moderationResult = moderation.results[0]
    
    if (moderationResult.flagged) {
      result.flagged = true
      result.severity = 'high'
      
      // Map OpenAI categories to our categories
      if (moderationResult.categories.hate) result.categories.hate = true
      if (moderationResult.categories.violence) result.categories.violence = true
      if (moderationResult.categories.harassment) result.categories.harassment = true
      if (moderationResult.categories['sexual/minors'] || moderationResult.categories.sexual) {
        result.categories.sexual = true
      }
      
      result.reason = 'Contenu inapproprié détecté par modération automatique'
    }

    // Custom moderation rules
    const lowerMessage = message.toLowerCase()

    // Detect prompt injection attempts
    const injectionPatterns = [
      /ignore\s+(previous|all)\s+(instructions?|prompts?)/i,
      /you\s+are\s+now\s+/i,
      /system\s*:\s*/i,
      /forget\s+(everything|all)/i,
      /pretend\s+(you\s+are|to\s+be)/i,
      /roleplay\s+as/i,
      /act\s+as\s+(?!fred|wav)/i, // Allow "act as Fred" but not others
    ]

    if (injectionPatterns.some(pattern => pattern.test(message))) {
      result.flagged = true
      result.categories.injection = true
      result.severity = 'medium'
      result.reason = 'Tentative de manipulation du prompt détectée'
    }

    // Detect vague/too general questions
    const vaguePatterns = [
      /^(salut|hello|bonjour)$/i,
      /^(comment ça va|ça va)$/i,
      /^(aide moi|help)$/i,
      /^(que faire|what to do)$/i,
    ]

    if (vaguePatterns.some(pattern => pattern.test(message.trim()))) {
      result.categories.vague = true
      result.severity = 'low'
      result.reason = 'Question trop vague, plus de contexte nécessaire'
    }

    // Detect financial advice requests (we're not financial advisors)
    const financePatterns = [
      /investir|investment|crypto|bitcoin|trading|bourse|actions/i,
      /conseil.{0,20}financier|financial.{0,20}advice/i,
      /combien.{0,20}(gagner|revenus|argent)/i,
    ]

    if (financePatterns.some(pattern => pattern.test(message))) {
      result.categories.finance = true
      result.severity = 'medium'
      result.reason = 'Demande de conseil financier détectée'
    }

    // Detect illegal content requests
    const illegalPatterns = [
      /piratage|hacking|crack|torrent|télécharg.{0,20}illégal/i,
      /contourner|bypass|frauder/i,
      /faux.{0,20}(abonnés|vues|likes)/i,
    ]

    if (illegalPatterns.some(pattern => pattern.test(message))) {
      result.flagged = true
      result.categories.illegal = true
      result.severity = 'high'
      result.reason = 'Demande potentiellement illégale détectée'
    }

    // Detect uncertainty markers (user seems unsure)
    const uncertaintyPatterns = [
      /je\s+ne\s+sais\s+pas\s+si/i,
      /peut.?être|maybe|uncertain/i,
      /j'hésite|i'm\s+hesitating/i,
    ]

    if (uncertaintyPatterns.some(pattern => pattern.test(message))) {
      result.categories.uncertain = true
      result.reason = 'Utilisateur exprime de l\'incertitude'
    }

    return result

  } catch (error) {
    console.error('Error in message classification:', error)
    
    // Fallback: flag as uncertain if API fails
    return {
      flagged: false,
      categories: {
        ...result.categories,
        uncertain: true
      },
      severity: 'low',
      reason: 'Erreur de modération, traitement avec précaution'
    }
  }
}