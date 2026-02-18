# Multi-stage: build then run
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (production + dev for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Prisma generate needs DATABASE_URL (dummy at build time)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

COPY prisma ./prisma/
RUN npx prisma generate

# Source and build
COPY . .
RUN npm run build

# --- Runner stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# App artifacts from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/public ./public/
COPY --from=builder /app/ws-server ./ws-server/

# Regenerate Prisma client for this image (uses DATABASE_URL at runtime)
RUN npx prisma generate

# Default: run Next (override in compose for ws service)
EXPOSE 3001
CMD ["npm", "start"]
