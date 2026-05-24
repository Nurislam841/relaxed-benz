### Multi-stage Dockerfile — slim prod image suitable for Railway / Render / Fly.
###
### Stage 1 (builder): full toolchain. Installs deps, generates Prisma client,
### compiles TypeScript → dist/.
### Stage 2 (runner): only the compiled output, deps, and the generated Prisma
### client (copied straight from builder — avoids re-running `prisma generate`
### which would pull in `prisma@latest` and crash on our v5 schema).

# ── builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# bcrypt requires python+gcc; prisma needs openssl. Only in builder.
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app

RUN npm install -g pnpm@10

# Copy package metadata first to maximise layer caching when only src changes.
COPY package.json ./
COPY prisma ./prisma/
RUN pnpm install --no-frozen-lockfile

# Generate the Prisma Client into node_modules.
RUN npx prisma generate

# Now copy the rest of the source and build.
COPY tsconfig*.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm run build

# We deliberately DON'T prune dev deps here: the entrypoint script uses
# `prisma` (CLI) + `ts-node` (seed script) at runtime, both of which are
# devDependencies. Image size penalty (~80MB extra) is preferred over a
# more invasive split (moving them to deps would pollute the prod tree
# anyway).

# ── runner ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# openssl needed at runtime by prisma client for SSL connections.
RUN apk add --no-cache openssl
WORKDIR /app

RUN npm install -g pnpm@10

# Pull everything we need from the builder. We deliberately copy node_modules
# instead of running pnpm install + prisma generate here — that would
# auto-download `prisma@latest` (currently v7) which can't parse our v5
# schema (`datasource url` is deprecated there).
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh ./

# Persistent upload dir — mount a Railway volume here to keep files across
# restarts (only matters when STORAGE_MODE=disk; if you've moved to S3 you can
# skip the volume entirely).
RUN mkdir -p /app/uploads && chmod +x docker-entrypoint.sh

EXPOSE 4000
ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
