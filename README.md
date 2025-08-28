# Fred Wav Chatbot

Système de chatbot intelligent avec modération avancée "Wav Anti-Bullshit", RAG (Retrieval-Augmented Generation) et intégration multi-plateformes.

## Architecture

- **Web App**: Next.js avec App Router (TypeScript)
- **API Backend**: Routes Next.js pour chat et modération
- **RAG System**: Supabase avec pgvector pour embeddings
- **Discord Bot**: Bot privé avec threads /fred
- **Knowledge Base**: Ingestion automatique de fiches Markdown

## Structure du Projet

```
apps/
├── web/              # Application web Next.js
│   ├── app/          # App Router Next.js
│   ├── lib/          # Utilitaires (RAG, modération, persona)
│   └── config/       # Configuration (Supabase, env)
└── discord-bot/      # Bot Discord
    ├── commands/     # Commandes slash
    └── utils/        # Utilitaires Discord

db/                   # Schémas Supabase
kb/                   # Base de connaissances (Markdown)
config/               # Configuration globale
scripts/              # Scripts d'ingestion
```

## Installation & Configuration

### Prérequis
- Node.js 20+
- pnpm
- Supabase CLI
- Compte Discord Developer

### Installation
```bash
pnpm install
```

### Configuration
1. Copier `.env.example` vers `.env`
2. Remplir les variables d'environnement
3. Configurer Supabase avec les schémas dans `db/`

### Développement
```bash
# Lancer l'app web
pnpm dev

# Lancer le bot Discord
pnpm discord

# Ingérer la base de connaissances
pnpm ingest
```

## Fonctionnalités

### Wav Anti-Bullshit System
- Modération multicouche (N1/N2/N3)
- Détection de prompt injection
- Heuristiques pour éviter les hallucinations
- Protocole "Je ne sais pas" pour sujets incertains

### RAG (Retrieval-Augmented Generation)
- Recherche hybride (BM25 + cosine similarity)
- Chunking intelligent avec overlap
- Embeddings avec OpenAI
- Namespaces par utilisateur

### Discord Integration
- Commande `/fred` avec threads privés
- Relais automatique vers l'API
- Modération en temps réel

## Déploiement

### Web App (Vercel)
```bash
vercel --prod
```

### Discord Bot
- Docker ou PM2 sur serveur dédié
- Variables d'environnement configurées

## Statut d'Implémentation

- [x] Phase 1: Structure monorepo
- [ ] Phase 2: Persona et guardrails
- [ ] Phase 3: Schéma Supabase + RLS
- [ ] Phase 4: Système RAG
- [ ] Phase 5: API modération + chat
- [ ] Phase 6: Interface web
- [ ] Phase 7: Bot Discord
- [ ] Phase 8: Ingestion KB
- [ ] Phase 9: Configuration finale
- [ ] Phase 10: CI/CD
- [ ] Phase 11: Git hooks