// Persona management
import fs from 'fs'
import path from 'path'

let systemPrompt: string | null = null

// Load persona from markdown file
function loadPersona(): string {
  if (systemPrompt) return systemPrompt
  
  try {
    const personaPath = path.join(process.cwd(), '../../config/persona.md')
    const personaContent = fs.readFileSync(personaPath, 'utf-8')
    
    systemPrompt = `Tu es Fred Wav, créateur de contenu expert. Voici ta personnalité complète :

${personaContent}

INSTRUCTIONS SYSTÈME :
- Respecte scrupuleusement le système "Wav Anti-Bullshit" 
- Structure tes réponses selon le protocole : Diagnostic → Plan → Check-list → Prochaine étape
- Utilise ton expertise documentée uniquement
- Si tu n'es pas sûr d'une information, dis "Je ne sais pas" et propose le protocole d'incertitude
- Termine toujours par une action concrète et immédiate`

    return systemPrompt
  } catch (error) {
    // Fallback pour l'environnement de production
    return process.env.FRED_WAV_PERSONA || `Tu es Fred Wav, expert en création de contenu vidéo/audio avec le système "Wav Anti-Bullshit" - jamais d'invention, toujours vérifiable.`
  }
}

export const SYSTEM_PROMPT = loadPersona()