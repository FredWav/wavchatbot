# Fred Wav Chatbot

Système de chatbot intelligent avec modération avancée "Wav Anti-Bullshit" et RAG (Retrieval-Augmented Generation) pour interface web.

## ✨ Fonctionnalités

- **🤖 IA Conversationnelle** : Chat alimenté par GPT-4 avec personnalité Fred Wav
- **🛡️ Wav Anti-Bullshit** : Système de modération avancée anti-hallucination
- **📚 RAG Intelligence** : Recherche hybride (BM25 + vecteurs) sur base de connaissances
- **🌐 Interface Web** : Chat responsive avec badge de certification
- **📊 Analytics Complets** : Suivi des conversations et métriques d'engagement

## 🏗️ Architecture

```
📦 wavchatbot/
├── 🌐 apps/web/              # Application Next.js
│   ├── app/                  # App Router + API routes
│   ├── lib/                  # RAG, modération, persona
│   └── config/               # Supabase, environnement
├── 🗄️ db/                   # Schémas Supabase
├── 📚 kb/                   # Base de connaissances
├── ⚙️ config/               # Configuration globale
└── 🔧 scripts/              # Scripts d'ingestion
```

## 🚀 Installation Rapide

### Prérequis
- **Node.js 20+**
- **npm** (gestionnaire de packages)
- **Compte OpenAI** (API key)
- **Projet Supabase** (base de données)

### 1. Cloner et Installer
```bash
git clone https://github.com/FredWav/wavchatbot.git
cd wavchatbot
npm install
```

### 2. Configuration Environnement
```bash
cp .env.example .env
# Éditer .env avec vos clés API
```

**Variables requises :**
```env
OPENAI_API_KEY=sk-votre_clé_openai
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE=votre_clé_service_role
```

### 3. Base de Données
```bash
# Dans Supabase SQL Editor, exécuter :
# 1. db/schema.sql (tables + pgvector)
# 2. db/rls.sql (sécurité)
```

### 4. Ingestion Base de Connaissances
```bash
npm run ingest
```

### 5. Lancement
```bash
# Application web
npm run dev
```

## 🌐 Déploiement

### Web App (Vercel)
```bash
# Connecter repo GitHub à Vercel
# Variables d'environnement dans Vercel dashboard
vercel --prod
```

## 📖 Guide d'Utilisation

### Interface Web
1. **Accéder** : `http://localhost:3000`
2. **Poser question** : Interface chat intuitive
3. **Recevoir réponse** : Diagnostic → Plan → Check-list → Prochaine étape

### Wav Anti-Bullshit System
- **N1** : "Je ne sais pas" si informations insuffisantes
- **N2** : Avertissement pour sujets mouvants (prix, algos, etc.)
- **N3** : Refus pour contradictions détectées dans sources

## 🔧 Configuration Avancée

### Environment Variables Complètes
```env
# Core (requis)
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE=...

# Advanced (optionnel)
API_BASE_URL=http://localhost:3000
RAG_NAMESPACE_FRED=fred_corpus
FRED_WAV_PERSONA="Custom persona..."
```

### Structure Base de Connaissances
```
kb/
├── A-Persona/           # Identité Fred Wav
├── B-TikTok/           # Stratégies TikTok
├── C-Lives/            # Streaming live
├── D-Multi-plateformes/ # Cross-platform
├── E-Audiovisuel/      # Production vidéo
├── F-Montage/          # Techniques montage
├── G-Monetisation/     # Stratégies revenus
├── I-SocialBoost-Pro/  # Croissance audience
├── J-Crypto/           # Web3 & crypto
├── K-Verification/     # Certification
├── L-VEO3-Regis/       # Outils spécialisés
└── M-RGPD-Secu/        # Conformité légale
```

### Ajout de Contenu
```bash
# 1. Créer fichier .md dans kb/[catégorie]/
# 2. Lancer ingestion
npm run ingest
# 3. Contenu automatiquement vectorisé et indexé
```

## 🔍 API Documentation

### Chat Endpoint
```bash
POST /api/chat
Content-Type: application/json

{
  "message": "Comment optimiser l'algorithme TikTok ?",
  "conversationId": "uuid-optionnel"
}
```

**Réponse :**
```json
{
  "response": "Diagnostic → Plan → Check-list...",
  "conversationId": "uuid",
  "metadata": {
    "sources": 3,
    "movable": true,
    "contradiction": false
  }
}
```

### Moderation Endpoint
```bash
POST /api/moderate
Content-Type: application/json

{
  "message": "Texte à modérer"
}
```

## 📊 Métriques & Analytics

### Métriques Système
- **Temps de réponse** : < 3s pour requêtes simples
- **Précision RAG** : 85%+ pertinence sources
- **Taux de refus WAB** : 5-10% (protection hallucinations)
- **Uptime Web** : 99.9%+

### Métriques Utilisateur
- **Conversations actives** : Tableau Supabase
- **Messages/jour** : Analytics web
- **Sources utilisées** : Métriques RAG
- **Feedback quality** : Ratings utilisateurs

## 🛠️ Développement

### Structure Code
```typescript
// RAG System
import { retrieveContext } from '@/lib/rag'
const { hits, contradiction } = await retrieveContext(message, userId)

// Guardrails
import { shouldSayIDK, composeRefusal } from '@/lib/guardrails'
if (shouldSayIDK(hits, movable, contradiction)) {
  return composeRefusal(category, severity)
}

// Persona
import { SYSTEM_PROMPT } from '@/lib/persona'
// Automatically loaded from config/persona.md
```

### Tests
```bash
# Tester API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Salut Fred!"}'

# Tester modération
curl -X POST http://localhost:3000/api/moderate \
  -H "Content-Type: application/json" \
  -d '{"message": "Test content"}'
```

### Debug
```bash
# Logs application
npm run dev --debug

# Test ingestion
node scripts/ingest.js --verbose
```

## 🤝 Contribution

### Ajout de Fonctionnalités
1. **Fork** le repository
2. **Branch** : `feature/nouvelle-fonctionnalite`
3. **Développer** avec tests
4. **PR** avec description détaillée

### Ajout de Contenu KB
1. **Créer** fichier `.md` dans `kb/[catégorie]/`
2. **Structurer** : # Titre, ## Sections, ### Sous-sections
3. **Tester** : `npm run ingest` puis questions dans chat
4. **PR** avec contexte d'utilisation

## 📋 Roadmap

### Phase Actuelle ✅
- [x] Core RAG system avec Supabase pgvector
- [x] Interface web responsive
- [x] Système WAB complet
- [x] Knowledge base ingestion

### Prochaines Étapes 🚧
- [ ] Analytics dashboard admin
- [ ] Multi-language support
- [ ] Voice chat integration
- [ ] Mobile app (React Native)
- [ ] API rate limiting
- [ ] Advanced caching

## 📞 Support

### Issues Fréquents

**Erreur "Missing API Key" :**
```bash
# Vérifier .env
cat .env | grep OPENAI_API_KEY
# Redémarrer si modifié
npm run dev
```

**Embeddings échouent :**
```bash
# Vérifier quota OpenAI
# Réduire batch size dans scripts/ingest.js
# Attendre rate limit reset
```

### Contact
- **GitHub Issues** : Pour bugs et features
- **Email** : support@fredwav.com

## 📜 Licence

MIT License - Voir [LICENSE](LICENSE) pour détails.

---

**✅ Certifié Wav Anti-Bullshit** — jamais d'invention, toujours vérifiable

Développé avec ❤️ par l'équipe Fred Wav