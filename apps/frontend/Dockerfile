### Multi-stage Next.js Dockerfile for Railway / Render / Fly.
### Slimmer prod image; respects Railway's $PORT env (start on whatever is given).

# ── builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .

# NEXT_PUBLIC_API_URL must be a build-arg because Next inlines it into the
# client bundle. Railway exposes the same value at runtime via env vars; we
# default to /api for same-origin deploys (frontend + backend on same host).
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm run build

# ── runner ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@10

# Copy package + node_modules (prod only) + the built .next directory.
COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

# Railway injects $PORT — Next picks it up via -p. Default to 3000 for
# parity with `pnpm start` locally.
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "pnpm start -p ${PORT:-3000}"]
