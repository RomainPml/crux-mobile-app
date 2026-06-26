# Crux

A daily brain game where players solve Einstein-style logic puzzles and compete with friends in leagues.

Each day, a new 4x4 logic grid is generated. Players deduce the solution from a set of clues, racing against the clock. Scores feed into monthly league standings with deterministic tiebreaking and badge rewards.

## Architecture

Monorepo managed with pnpm (hoisted):

- **`apps/api`** — Fastify REST API with Prisma ORM and PostgreSQL
- **`apps/mobile`** — Expo (React Native) app with Expo Router and TanStack Query
- **`apps/invite-web`** — Static landing page for invite/deep links
- **`packages/shared`** — Zod schemas and TypeScript types shared between API and mobile

## Features

- **Daily puzzles** — Procedurally generated Einstein riddles with constraint-propagation solver
- **Anonymous-first auth** — Device key to JWT, optional username
- **Leagues** — Create, join via invite code, and compete on monthly standings
- **Scoring** — Monthly leaderboards with tiebreak on score, puzzles played, cumulative time, and join date
- **Badges** — 6 badge types awarded on monthly rollover, including cross-month streaks
- **Offline support** — Puzzle caching, retry with backoff, typed error handling

## Prerequisites

- Node 20 LTS
- PostgreSQL 16
- pnpm 10+

## Setup

```bash
pnpm install
cp .env.example apps/api/.env   # edit DATABASE_URL
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma
npx prisma generate --schema=apps/api/prisma/schema.prisma
npx tsx apps/api/prisma/seed.ts
```

## Development

```bash
# API (port 3000)
pnpm api

# Mobile (Expo dev server)
pnpm mobile

# Tests
pnpm test          # API tests
pnpm test:shared   # Shared package tests
```

## License

Private — all rights reserved.
