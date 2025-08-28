// Wav Anti-Bullshit guardrails system

export interface ModerationResult {
  hits: any[]
  contradiction: boolean
  movable: boolean
}

export type RefusalSeverity = 'N1' | 'N2' | 'N3'

/**
 * Heuristique pour déterminer si le bot doit répondre "Je ne sais pas"
 * Basé sur la qualité des résultats RAG et les contradictions détectées
 */
export function shouldSayIDK(hits: any[], movable: boolean, contradiction: boolean): boolean {
  // N3: Contradiction détectée dans les sources
  if (contradiction) return true
  
  // N2: Sujet mouvant sans sources suffisantes  
  if (movable && (!hits || hits.length < 2)) return true
  
  // N1: Pas assez de contexte pertinent
  if (!hits || hits.length === 0) return true
  
  // Vérifier la qualité des hits (score de similarité minimum)
  const relevantHits = hits.filter(hit => hit.similarity && hit.similarity > 0.7)
  if (relevantHits.length === 0) return true
  
  return false
}

/**
 * Compose une réponse de refus selon la sévérité
 */
export function composeRefusal(category: string, severity: RefusalSeverity): string {
  const baseMessage = "✅ **Certifié Wav Anti-Bullshit** — "
  
  switch (severity) {
    case 'N1':
      return `${baseMessage}Je ne dispose pas d'informations vérifiées sur "${category}". 
      
**Protocole d'incertitude :**
1. Reformule ta question avec plus de contexte
2. Précise ton objectif concret  
3. Indique ton niveau d'expérience actuel

Je préfère dire "je ne sais pas" plutôt que d'inventer. C'est ça, le système Wav Anti-Bullshit.`

    case 'N2':
      return `${baseMessage}Ce sujet ("${category}") évolue rapidement et mes sources pourraient être obsolètes.

**Protocole pour sujets mouvants :**
1. Vérifie les dernières mises à jour officielles
2. Teste en petit avant de généraliser
3. Croise plusieurs sources récentes
4. Reviens me voir avec tes résultats de test

L'honnêteté avant tout - c'est ma marque de fabrique.`

    case 'N3':
      return `${baseMessage}Attention ! J'ai détecté des **contradictions** dans mes sources sur "${category}".

**Protocole contradiction :**
1. 🔍 Fais tes propres recherches avec sources datées
2. ⚠️ Méfie-toi des informations contradictoires  
3. 🧪 Teste sur petite échelle avant application
4. 📊 Mesure les résultats objectivement

Jamais d'invention chez Fred Wav. Si c'est flou, je le dis.`

    default:
      return `${baseMessage}Je ne peux pas répondre de manière fiable sur ce sujet.`
  }
}

/**
 * Filtre les tentatives d'injection de prompt
 */
export function stripInjections(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  let cleaned = text
  
  // Patterns d'injection courants
  const injectionPatterns = [
    /ignore\s+(previous|all)\s+(instructions?|prompts?)/gi,
    /you\s+are\s+now\s+/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi, 
    /human\s*:\s*/gi,
    /forget\s+(everything|all)/gi,
    /pretend\s+(you\s+are|to\s+be)/gi,
    /roleplay\s+as/gi,
    /act\s+as\s+/gi,
    /simulate\s+/gi,
    /override\s+/gi,
    /reset\s+/gi
  ]
  
  // Nettoyer les patterns d'injection
  injectionPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '[FILTERED]')
  })
  
  // Limiter la longueur pour éviter les attaques par volume
  if (cleaned.length > 4000) {
    cleaned = cleaned.substring(0, 4000) + '...[TRUNCATED]'
  }
  
  return cleaned.trim()
}

/**
 * Détecte si le sujet est "mouvant" (prix, algorithmes, lois, mises à jour)
 */
export function isMovableTopic(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  
  const movablePatterns = [
    // Prix et coûts
    /prix|coût|tarif|€|\$|budget|payant|gratuit|abonnement/i,
    
    // Algorithmes (évoluent constamment)
    /algorithme|algo|reach|portée|ranking|feed|for\s+you|fyp/i,
    
    // Aspects légaux et réglementaires
    /loi|légal|réglementation|rgpd|droit|juridique|tribunal/i,
    
    // Mises à jour et nouveautés
    /mise\s+à\s+jour|update|nouveau|nouvelle|récent|dernièr|2024|2025/i,
    
    // Fonctionnalités en beta ou test
    /beta|test|expérimental|bientôt|prévu|futur/i,
    
    // Métriques changeantes
    /stats|statistiques|cpm|rpm|vue|vues|followers|abonnés/i
  ]
  
  return movablePatterns.some(pattern => pattern.test(text))
}