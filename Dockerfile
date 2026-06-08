# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

# ---- Dependencies (full, including dev deps needed to build) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build the Next.js app ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- Runtime image ----
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --chown=nextjs:nodejs package.json server.ts next.config.ts tsconfig.json ./
COPY --chown=nextjs:nodejs lib ./lib
COPY --chown=nextjs:nodejs types ./types
COPY --chown=nextjs:nodejs app ./app

USER nextjs

EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "server.ts"]
