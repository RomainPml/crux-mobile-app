# Crux — Developer Guide

## Prerequisites
- Node 20 LTS (see `.nvmrc`)
- PostgreSQL 16
- pnpm 10+

## Setup
```bash
pnpm install
cp .env.example apps/api/.env  # edit DATABASE_URL
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma
npx prisma generate --schema=apps/api/prisma/schema.prisma
npx tsx apps/api/prisma/seed.ts
```

## Run
```bash
# API (port 3000)
pnpm api

# Mobile (requires --no-experimental-require-module for Node 20.20+)
pnpm mobile

# Tests
pnpm test          # API tests (52)
pnpm test:shared   # Shared package tests (8)
```

## Architecture
- `apps/api` — Fastify + Prisma + PostgreSQL
- `apps/mobile` — Expo 52 + Expo Router + TanStack Query
- `apps/invite-web` — Static landing page for invite links
- `packages/shared` — Zod schemas + types (single contract app <-> API)

## Key conventions
- Score decoupled from league: `daily_result` links to `(user, puzzle)`, never to a league
- Tiebreak: total_score DESC, puzzles_played DESC, cumulative_time_ms ASC, joined_at ASC
- Timezone: Europe/Paris for month boundaries
- League codes: 6 alphanumeric chars, no ambiguous 0/O/1/I
- `node-linker=hoisted` in `.npmrc` (required for Expo + pnpm)

## Node 20.20+ note
Node 20.20+ enables `--experimental-require-module` by default, which breaks
`expo-modules-core` (it exports `.ts` from its main field). The mobile start
script passes `--no-experimental-require-module` to work around this.
