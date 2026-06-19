import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();
const MONTH = "2026-04";
let token: string;
let userId: string;

beforeAll(async () => {
  await app.ready();

  const res = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: "profile-test-device-key-1" });
  token = res.body.token;
  userId = res.body.userId;

  // Create a league, add user, create history and badges
  const league = await prisma.league.upsert({
    where: { code: "PRFLGE" },
    update: {},
    create: { name: "Profile League", code: "PRFLGE", type: "PRIVATE" },
  });

  await prisma.membership.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId } },
    update: {},
    create: { leagueId: league.id, userId },
  });

  // Simulate a past month standing
  await prisma.leagueStandingHistory.upsert({
    where: { leagueId_userId_month: { leagueId: league.id, userId, month: MONTH } },
    update: {},
    create: {
      leagueId: league.id,
      userId,
      month: MONTH,
      finalRank: 2,
      finalScore: 1500,
      membersCount: 8,
    },
  });

  // Award a badge
  const badge = await prisma.badge.findUnique({ where: { code: "podium_mensuel" } });
  if (badge) {
    await prisma.userBadge
      .create({
        data: {
          userId,
          badgeId: badge.id,
          context: { leagueId: league.id, month: MONTH },
        },
      })
      .catch((e: any) => {
        if (e.code !== "P2002") throw e;
      });
  }
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /me/profile", () => {
  it("returns user profile with badges and history", async () => {
    const res = await supertest(app.server)
      .get("/me/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.userId).toBe(userId);
    expect(res.body).toHaveProperty("pseudo");
    expect(res.body).toHaveProperty("badges");
    expect(res.body).toHaveProperty("monthlyHistory");
  });

  it("includes awarded badges", async () => {
    const res = await supertest(app.server)
      .get("/me/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const podium = res.body.badges.find((b: any) => b.code === "podium_mensuel");
    expect(podium).toBeDefined();
    expect(podium.name).toBe("Podium mensuel");
    expect(podium).toHaveProperty("awardedAt");
    expect(podium.context).toHaveProperty("month");
  });

  it("includes monthly standing history", async () => {
    const res = await supertest(app.server)
      .get("/me/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const entry = res.body.monthlyHistory.find((h: any) => h.month === MONTH);
    expect(entry).toBeDefined();
    expect(entry.finalRank).toBe(2);
    expect(entry.finalScore).toBe(1500);
    expect(entry.membersCount).toBe(8);
    expect(entry.leagueName).toBe("Profile League");
  });

  it("rejects unauthenticated requests", async () => {
    await supertest(app.server).get("/me/profile").expect(401);
  });
});
