import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();

const MONTH = "2026-05"; // past month for rollover
let league: { id: string };
const userIds: string[] = [];
let tokenAdmin: string;

beforeAll(async () => {
  await app.ready();

  // Clean up any previous test data for this month
  await prisma.leagueStandingHistory.deleteMany({ where: { month: MONTH } });
  await prisma.userBadge.deleteMany({
    where: { context: { path: ["month"], equals: MONTH } },
  });

  // Create a league with 3 members
  league = await prisma.league.upsert({
    where: { code: "RLOVER" },
    update: {},
    create: { name: "Rollover League", code: "RLOVER", type: "PRIVATE" },
  });

  // Create 3 users with monthly scores for the past month
  for (let i = 0; i < 3; i++) {
    const res = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: `rollover-test-user-${i}-pad` });
    userIds.push(res.body.userId);
    if (i === 0) tokenAdmin = res.body.token;

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
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /admin/month-rollover", () => {
  it("freezes standings into league_standing_history", async () => {
    const res = await supertest(app.server)
      .post("/admin/month-rollover")
      .send({ month: MONTH })
      .expect(200);

    expect(res.body.ok).toBe(true);

    const history = await prisma.leagueStandingHistory.findMany({
      where: { leagueId: league.id, month: MONTH },
      orderBy: { finalRank: "asc" },
    });

    expect(history).toHaveLength(3);
    expect(history[0].userId).toBe(userIds[0]); // 900 pts
    expect(history[0].finalRank).toBe(1);
    expect(history[0].finalScore).toBe(900);
    expect(history[1].finalRank).toBe(2);
    expect(history[2].finalRank).toBe(3);
  });

  it("is idempotent — replaying produces the same state", async () => {
    // Run rollover again
    await supertest(app.server)
      .post("/admin/month-rollover")
      .send({ month: MONTH })
      .expect(200);

    const history = await prisma.leagueStandingHistory.findMany({
      where: { leagueId: league.id, month: MONTH },
    });

    // Still exactly 3 entries, no duplicates
    expect(history).toHaveLength(3);
  });

  it("awards podium_mensuel badges to top 3", async () => {
    const podiumBadge = await prisma.badge.findUnique({
      where: { code: "podium_mensuel" },
    });

    const badges = await prisma.userBadge.findMany({
      where: {
        badgeId: podiumBadge!.id,
        context: { path: ["leagueId"], equals: league.id },
      },
    });

    // All 3 users in a 3-member league get podium
    expect(badges).toHaveLength(3);
  });

  it("does NOT award champion_mensuel for leagues < 10 members", async () => {
    const championBadge = await prisma.badge.findUnique({
      where: { code: "champion_mensuel" },
    });

    const badges = await prisma.userBadge.findMany({
      where: {
        badgeId: championBadge!.id,
        context: { path: ["leagueId"], equals: league.id },
      },
    });

    expect(badges).toHaveLength(0);
  });

  it("does not duplicate badges on replay", async () => {
    // Third run
    await supertest(app.server)
      .post("/admin/month-rollover")
      .send({ month: MONTH })
      .expect(200);

    const podiumBadge = await prisma.badge.findUnique({
      where: { code: "podium_mensuel" },
    });

    const badges = await prisma.userBadge.findMany({
      where: {
        badgeId: podiumBadge!.id,
        context: { path: ["leagueId"], equals: league.id },
      },
    });

    // Still exactly 3, no duplicates
    expect(badges).toHaveLength(3);
  });

  it("rejects invalid month format", async () => {
    await supertest(app.server)
      .post("/admin/month-rollover")
      .send({ month: "bad" })
      .expect(400);
  });
});
