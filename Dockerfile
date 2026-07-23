# syntax=docker/dockerfile:1

# Kangna Beauty & Jewellery CRM — production Docker image.
#
# This app is a normal `next start` server (no `output: "standalone"` in
# next.config.ts — deliberately left untouched, since setting it can change
# how Vercel's own builder packages the app, and this project is deployed on
# Vercel as well as run locally via Docker). The runtime stage below instead
# installs production-only dependencies directly, which is a few dozen MB
# larger than a standalone build but has zero risk of affecting the Vercel
# deployment path.
#
# Prisma 7 driver-adapter note (see MEMORY.md Stage 0/2): this project's
# PrismaClient is constructed from `@prisma/adapter-pg` wrapping a `pg` Pool,
# not the classic Prisma query-engine binary, so no Prisma engine binaries
# need to be downloaded/copied into the image — only the generated
# TypeScript client at lib/generated/prisma (gitignored, built with
# `prisma generate` during the build stage) and the ordinary `pg` npm
# package (already a normal `dependencies` entry).
#
# Build:   docker build -t kangana-crm .
# Run:     docker run -p 3000:3000 --env-file .env kangana-crm
# (or use `docker compose up --build` — see docker-compose.yml)

FROM node:22-alpine AS base
WORKDIR /app
# Next.js on Alpine needs libc6-compat for some native deps it may pull in.
RUN apk add --no-cache libc6-compat

# ---- deps: full (dev+prod) dependencies, used only to build ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- prod-deps: production-only dependencies for the final runtime image ----
FROM base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` only reads the schema — it makes no live DB connection —
# but prisma.config.ts loads DATABASE_URL_UNPOOLED via dotenv at import time,
# so a placeholder value keeps the generate step working even when no real
# secret is passed at build time. Pass --build-arg DATABASE_URL_UNPOOLED=...
# to override if needed; it is never baked into the final runtime image.
ARG DATABASE_URL_UNPOOLED="postgresql://user:password@localhost:5432/kangana_build_placeholder"
ENV DATABASE_URL_UNPOOLED=$DATABASE_URL_UNPOOLED
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/docker-entrypoint.js ./docker-entrypoint.js

USER nextjs
EXPOSE 3000

# Real runtime config (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, etc.) is
# expected to be supplied via `docker run --env-file .env` / Docker Desktop's
# environment settings / docker-compose.yml — see .env.example for the full
# list. Nothing secret is baked into this image.
#
# Runs through docker-entrypoint.js rather than `npm run start` directly —
# see that file for why: Docker's env-file loading doesn't strip quotes the
# way `next dev`'s dotenv loading does, and this project's real `.env` file
# has quoted values.
CMD ["node", "docker-entrypoint.js"]
