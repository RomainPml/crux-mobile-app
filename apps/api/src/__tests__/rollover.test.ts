import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();

const MONTH = "2025-11"; // isolated month for rollover tests
let league: { id: string };
const userIds: string[] = [];

beforeAll(async () => {
  await app.ready();

  // Clean up any previous test data for this month
  await prisma.leagueStandingHistory.deleteMany({ where: { month: MONTH } });
  await prisma.userBadge.deleteMany({
    where: { context: { path: ["month"], equals: MONTH } },
  });

  // Create a league with 3 members + owner
  const authRes = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: "rollover-owner-test-key-1" });
  const ownerId = authRes.body.userId;

  league = await prisma.league.upsert({
    where: { code: "RLOVER" },
    update: { ownerId },
    create: { name: "Rollover League", code: "RLOVER", type: "PRIVATE", ownerId },
  });

  // Create 3 users with monthly scores
  for (let i = 0; i < 3; i++) {
    const res = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: `rollover-test-user-${i}-pad` });
    userIds.push(res.body.userId);

    await prisma.membership.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId: res.body.userId } },
      update: {},
      create: { leagueId: league.id, userId: res.body.userId },
    });

    await prisma.monthlyScore.upsert({
      where: { userId_month: { userId: res.body.userId, month: MONTH } },
      update: { totalScore: (3 - i) * 300, puzzlesPlayed: 10, cumulativeTimeMs: 100_000 },
      create: {
        userId: res.body.userId,
        month: MONTH,
        totalScore: (3 - i) * 300,
        puzzlesPlayed: 10,
        cumulativeTimeMs: 100_000,
      },
    });
  }

  // Create daily results for streak & sans_faute badge tests
  // User 0: 10 consecutive days in November 2025, with clean deductions
  const puzzle0Ids: string[] = [];
  for (let d = 1; d <= 10; d++) {
    const day = new Date(2025, 10, d); // November
    const puzzle = await prisma.puzzle.upsert({
      where: { day },
      update: {},
      create: { day, difficulty: 3 },
    });
    puzzle0Ids.push(puzzle.id);
  }

  for (let d = 0; d < 10; d++) {
    const servedAt = new Date(2025, 10, d + 1, 8, 0, 0);
    await prisma.dailyResult.upsert({
      where: { userId_puzzleId: { userId: userIds[0], puzzleId: puzzle0Ids[d] } },
      update: {},
      create: {
        userId: userIds[0],
        puzzleId: puzzle0Ids[d],
        score: 500,
        timeMs: 60_000,
        cleanDeductions: d === 0 ? 3 : 0, // first day has clean deductions
        servedAt,
        submittedAt: new Date(servedAt.getTime() + 60_000),
        suspect: false,
      },
    });
  }
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /admin/month-rollover", () => {
  it("freezes standings into league_standing_history", async () => {
    const res = await supertest(app.server)
      .post("/admin/month-rollover")
      .set("x-admin-key", "dev-admin-key")
      .send({ month: MONTH })
      .expect(200);

    expect(res.body.ok).toBe(true);

    const history = await prisma.leagueStandingHistory.findMany({
      where: { leagueId: league.id, month: MONTH },
      orderBy: { finalRank: "asc" },
    });

    expect(history).toHaveLength(3);
    expect(history[0].userId).toBe(userIds[0]);
    expect(history[0].finalRank).toBe(1);
    expect(history[0].finalScore).toBe(900);
    expect(history[1].finalRank).toBe(2);
    expect(history[2].finalRank).toBe(3);
  });

  it("is idempotent — replaying produces the same state", async () => {
    await supertest(app.server)
      .post("/admin/month-rollover")
      .set("x-admin-key", "dev-admin-key")
      .send({ month: MONTH })
      .expect(200);

    const history = await prisma.leagueStandingHistory.findMany({
      where: { leagueId: league.id, month: MONTH },
    });

    expect(history).toHaveLength(3);
  });

  it("awards podium_mensuel badges to top 3", async () => {
    const podiumBadge = await prisma.badge.findUnique({ where: { code: "podium_mensuel" } });
    const badges = await prisma.userBadge.findMany({
      where: {
        badgeId: podiumBadge!.id,
        context: { equals: { leagueId: league.id, month: MONTH } },
      },
    });

    expect(badges).toHaveLength(3);
  });

  it("does NOT award champion_mensuel for leagues < 10 members", async () => {
    const badge = await prisma.badge.findUnique({ where: { code: "champion_mensuel" } });
    const badges = await prisma.userBadge.findMany({
      where: {
        badgeId: badge!.id,
        context: { equals: { leagueId: league.id, month: MONTH } },
      },
    });

    expect(badges).toHaveLength(0);
  });

  it("awards serie_7 badge for 7+ consecutive days", async () => {
    const badge = await prisma.badge.findUnique({ where: { code: "serie_7" } });
    const awarded = await prisma.userBadge.findMany({
      where: {
        userId: userIds[0],
        badgeId: badge!.id,
        context: { path: ["month"], equals: MONTH },
      },
    });

    expect(awarded).toHaveLength(1);
  });

  it("awards sans_faute badge for clean deductions", async () => {
    const badge = await prisma.badge.findUnique({ where: { code: "sans_faute" } });
    const awarded = await prisma.userBadge.findMany({
      where: {
        userId: userIds[0],
        badgeId: badge!.id,
        context: { path: ["month"], equals: MONTH },
      },
    });

    expect(awarded).toHaveLength(1);
  });

  it("does not duplicate badges on replay", async () => {
    await supertest(app.server)
      .post("/admin/month-rollover")
      .set("x-admin-key", "dev-admin-key")
      .send({ month: MONTH })
      .expect(200);

    const podiumBadge = await prisma.badge.findUnique({ where: { code: "podium_mensuel" } });
    const badges = await prisma.userBadge.findMany({
      where: {
        badgeId: podiumBadge!.id,
        context: { equals: { leagueId: league.id, month: MONTH } },
      },
    });

    expect(badges).toHaveLength(3);

    const serieBadge = await prisma.badge.findUnique({ where: { code: "serie_7" } });
    const serieBadges = await prisma.userBadge.findMany({
      where: {
        userId: userIds[0],
        badgeId: serieBadge!.id,
        context: { path: ["month"], equals: MONTH },
      },
    });
    expect(serieBadges).toHaveLength(1);
  });

  it("rejects invalid month format", async () => {
    await supertest(app.server)
      .post("/admin/month-rollover")
      .set("x-admin-key", "dev-admin-key")
      .send({ month: "bad" })
      .expect(400);
  });
});
