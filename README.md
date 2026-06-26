# Crux

A Wordle-like daily word game in French with competitive rankings. Guess the word of the day, then compare your score with friends in leagues.

## Architecture

Monorepo managed with pnpm (hoisted):

- **`apps/api`** — Fastify REST API with Prisma ORM and PostgreSQL
- **`apps/mobile`** — Expo (React Native) app with Expo Router and TanStack Query
- **`apps/invite-web`** — Static landing page for invite/deep links
- **`packages/shared`** — Zod schemas and TypeScript types shared between API and mobile

## Features

- **Daily word puzzle** — A new word to guess every day, Wordle-style
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
