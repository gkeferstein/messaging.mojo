# ============================================
# MOJO Messaging API - Production Dockerfile
# Nach MOJO Coding Standards
# ============================================

FROM node:22-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ============================================
# Dependencies Stage
# ============================================
FROM base AS deps

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile --prod

# ============================================
# Build Stage
# ============================================
FROM base AS builder

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

# Generate Prisma Client
RUN pnpm db:generate

# Build TypeScript
RUN pnpm build

# ============================================
# Production Stage
# ============================================
FROM base AS runner

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 messaging

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Generate Prisma Client for production
RUN pnpm db:generate

USER messaging

EXPOSE 3020

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3020/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
