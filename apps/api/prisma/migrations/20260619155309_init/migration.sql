-- CreateEnum
CREATE TYPE "league_type" AS ENUM ('global', 'private');

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('admin', 'member');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "device_key_hash" TEXT NOT NULL,
    "pseudo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_result" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "temps_ms" INTEGER NOT NULL,
    "deductions_propres" INTEGER NOT NULL,
    "served_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "daily_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_score" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "puzzles_played" INTEGER NOT NULL DEFAULT 0,
    "cumulative_time_ms" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "monthly_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "type" "league_type" NOT NULL DEFAULT 'private',
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_standing_history" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "final_rank" INTEGER NOT NULL,
    "final_score" INTEGER NOT NULL,
    "members_count" INTEGER NOT NULL,

    CONSTRAINT "league_standing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "critere" TEXT NOT NULL,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badge" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,

    CONSTRAINT "user_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_device_key_hash_key" ON "user"("device_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_day_key" ON "puzzle"("day");

-- CreateIndex
CREATE UNIQUE INDEX "daily_result_user_id_puzzle_id_key" ON "daily_result"("user_id", "puzzle_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_score_user_id_month_key" ON "monthly_score"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "league_code_key" ON "league"("code");

-- CreateIndex
CREATE UNIQUE INDEX "membership_league_id_user_id_key" ON "membership"("league_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_standing_history_league_id_user_id_month_key" ON "league_standing_history"("league_id", "user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "badge_code_key" ON "badge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_badge_user_id_badge_id_context_key" ON "user_badge"("user_id", "badge_id", "context");

-- AddForeignKey
ALTER TABLE "daily_result" ADD CONSTRAINT "daily_result_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_result" ADD CONSTRAINT "daily_result_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_score" ADD CONSTRAINT "monthly_score_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league" ADD CONSTRAINT "league_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "league"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_standing_history" ADD CONSTRAINT "league_standing_history_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "league"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_standing_history" ADD CONSTRAINT "league_standing_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
