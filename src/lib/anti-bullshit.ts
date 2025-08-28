// WAV Anti-Bullshit System Configuration

export const ANTI_BULLSHIT_RULES = {
  // Core principle: Never fill gaps in information
  NEVER_FILL_GAPS: true,
  
  // Require reliable sources for claims
  REQUIRE_SOURCES: true,
  
  // Maximum clarification questions allowed
  MAX_CLARIFICATION_QUESTIONS: 2,
  
  // Movable information that requires verification
  MOVABLE_INFO_TRIGGERS: [
    'prix', 'price', 'cost', 'coût',
    'date', 'when', 'quand',
    'nouveau', 'new', 'latest', 'récent',
    'feature', 'fonctionnalité',
    'news', 'actualité', 'info'
  ],
  
  // Sensitive domains that require refusal
  SENSITIVE_DOMAINS: [
    'medical', 'médical', 'santé', 'health',
    'legal', 'juridique', 'law', 'droit',
    'financial', 'financier', 'invest', 'investir',
    'hate', 'haine', 'violence'
  ]
};

export const SYSTEM_PROMPT = `
RÈGLE CENTRALE – WAV ANTI BULLSHIT

Tu NE REMPLIS PAS les trous. Si l'info n'est pas disponible dans le contexte (RAG) ou source fiable, tu dis "Je ne sais pas" ou "Cette information n'est pas disponible dans mes sources".

JAMAIS de déductions aléatoires ou d'approximations sur :
- Prix, tarifs, coûts
- Dates récentes ou futures  
- Nouvelles fonctionnalités
- Actualités
- Informations "mobiles" qui changent rapidement

Si l'input utilisateur n'est pas clair, tu peux poser 1-2 questions max pour clarifier, mais tu ne devines JAMAIS.

REFUS OBLIGATOIRE pour :
- Conseils médicaux, juridiques, financiers
- Contenu haineux ou violent

Principe fondamental : "Mieux vaut dire 'Je ne sais pas' que de raconter n'importe quoi."
`;

export const IDK_RESPONSES = [
  "Je ne sais pas cette information précise.",
  "Cette information n'est pas disponible dans mes sources actuelles.",
  "Je ne peux pas confirmer cette donnée sans source fiable.",
  "Je préfère dire 'Je ne sais pas' plutôt que de donner une information incertaine.",
  "Cette information nécessiterait une vérification que je ne peux pas effectuer."
];

export function getRandomIdkResponse(): string {
  return IDK_RESPONSES[Math.floor(Math.random() * IDK_RESPONSES.length)];
}

export function detectMovableInfo(text: string): boolean {
  const lowerText = text.toLowerCase();
  return ANTI_BULLSHIT_RULES.MOVABLE_INFO_TRIGGERS.some(trigger => 
    lowerText.includes(trigger)
  );
}

export function detectSensitiveContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return ANTI_BULLSHIT_RULES.SENSITIVE_DOMAINS.some(domain => 
    lowerText.includes(domain)
  );
}

export function shouldRefuseAnswer(text: string): { 
  refuse: boolean; 
  reason?: string; 
  response?: string; 
} {
  if (detectSensitiveContent(text)) {
    return {
      refuse: true,
      reason: 'sensitive_content',
      response: "Je ne peux pas fournir de conseils médicaux, juridiques ou financiers. Pour ce type d'information, consultez un professionnel qualifié."
    };
  }
  
  if (detectMovableInfo(text)) {
    return {
      refuse: true,
      reason: 'movable_info',
      response: `${getRandomIdkResponse()} Cette information peut changer rapidement et nécessiterait une vérification en temps réel.`
    };
  }
  
  return { refuse: false };
}