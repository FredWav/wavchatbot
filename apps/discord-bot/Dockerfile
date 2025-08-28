# Discord Bot Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/discord-bot/package.json ./apps/discord-bot/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/discord-bot/node_modules ./apps/discord-bot/node_modules

# Copy source code
COPY apps/discord-bot ./apps/discord-bot
COPY package.json ./

# Install pnpm
RUN npm install -g pnpm

# Production image, copy all the files and run the bot
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 discordbot

# Copy the discord bot
COPY --from=builder --chown=discordbot:nodejs /app/apps/discord-bot ./apps/discord-bot
COPY --from=builder --chown=discordbot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=discordbot:nodejs /app/package.json ./package.json

USER discordbot

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Discord bot health check')" || exit 1

CMD ["node", "apps/discord-bot/index.js"]