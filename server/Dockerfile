# Build stage — full install, compile, generate Prisma client, then prune devDeps
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL required for Prisma to detect the correct query-engine binary
RUN apk add --no-cache openssl

COPY package*.json ./

# Copy Prisma schema before npm ci so the postinstall prisma generate
# runs with the correct schema and produces accurate TypeScript types
COPY prisma ./prisma

# Install all deps (including devDeps needed for tsc + prisma CLI)
RUN npm ci

COPY . .

# Compile TypeScript
RUN npm run build

# Generate Prisma client (needs prisma CLI from devDeps + OpenSSL)
RUN npm run prisma:generate

# Drop devDeps so the copied node_modules is production-only
RUN npm prune --omit=dev

# Production stage — no npm install, no postinstall scripts
FROM node:20-alpine

WORKDIR /app

# dumb-init for correct signal handling; openssl for Prisma query engine at runtime
RUN apk add --no-cache dumb-init openssl

# Copy pruned node_modules (includes @prisma/client + .prisma engine binaries,
# fully generated — no postinstall re-run needed)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy Prisma schema (needed for migrate deploy at startup if required)
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
