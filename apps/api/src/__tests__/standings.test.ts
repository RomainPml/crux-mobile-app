import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { currentMonth } from "@crux/shared";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { computeStandings } from "../standings.js";

const app = buildApp();

let league: { id: string; code: string };
const users: { id: string; token: string }[] = [];

beforeAll(async () => {
  await app.ready();

  // Create a private league for testing
  league = await prisma.league.upsert({
    where: { code: "TSTLGE" },
    update: {},
    create: { name: "Test League", code: "TSTLGE", type: "PRIVATE" },
  });

  // Create 4 users and add them to the league
  for (let i = 0; i < 4; i++) {
    const res = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: `standings-test-key-${i}-pad` });
    users.push({ id: res.body.userId, token: res.body.token });

    await prisma.membership.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId: res.body.userId } },
      update: {},
      create: {
        leagueId: league.id,
        userId: res.body.userId,
        joinedAt: new Date(Date.now() - (4 - i) * 1000), // stagger joinedAt
      },
    });
  }

  const month = currentMonth();

  const scoreData = [
    { idx: 0, totalScore: 500, puzzlesPlayed: 3, cumulativeTimeMs: 90_000 },
    { idx: 1, totalScore: 500, puzzlesPlayed: 3, cumulativeTimeMs: 120_000 },
    { idx: 2, totalScore: 500, puzzlesPlayed: 2, cumulativeTimeMs: 60_000 },
    { idx: 3, totalScore: 800, puzzlesPlayed: 5, cumulativeTimeMs: 200_000 },
  ];

  for (const d of scoreData) {
    await prisma.monthlyScore.upsert({
      where: { userId_month: { userId: users[d.idx].id, month } },
      update: { totalScore: d.totalScore, puzzlesPlayed: d.puzzlesPlayed, cumulativeTimeMs: d.cumulativeTimeMs },
      create: { userId: users[d.idx].id, month, totalScore: d.totalScore, puzzlesPlayed: d.puzzlesPlayed, cumulativeTimeMs: d.cumulativeTimeMs },
    });
  }
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("computeStandings", () => {
  it("ranks by total_score DESC first", async () => {
    const month = currentMonth();
    const standings = await computeStandings(league.id, month);

    expect(standings[0].userId).toBe(users[3].id); // 800 pts
    expect(standings[0].rank).toBe(1);
  });

  it("breaks ties by puzzles_played DESC", async () => {
    const month = currentMonth();
    const standings = await computeStandings(league.id, month);

    // Users 0,1 have 500pts/3puzzles; user 2 has 500pts/2puzzles
    const user2rank = standings.find((s) => s.userId === users[2].id)!.rank;
    const user0rank = standings.find((s) => s.userId === users[0].id)!.rank;
    expect(user2rank).toBeGreaterThan(user0rank);
  });

  it("breaks ties by cumulative_time ASC", async () => {
    const month = currentMonth();
    const standings = await computeStandings(league.id, month);

    // Users 0 and 1 have same score and puzzles, user 0 is faster (90s < 120s)
    const user0rank = standings.find((s) => s.userId === users[0].id)!.rank;
    const user1rank = standings.find((s) => s.userId === users[1].id)!.rank;
    expect(user0rank).toBeLessThan(user1rank);
  });

  it("produces deterministic full ordering", async () => {
    const month = currentMonth();
    const standings = await computeStandings(league.id, month);

    expect(standings.map((s) => s.userId)).toEqual([
      users[3].id, // 800pts
      users[0].id, // 500pts, 3 puzzles, 90s
      users[1].id, // 500pts, 3 puzzles, 120s
      users[2].id, // 500pts, 2 puzzles
    ]);

    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe("GET /leagues/:id/standings", () => {
  it("returns standings for a league", async () => {
    const res = await supertest(app.server)
      .get(`/leagues/${league.id}/standings`)
      .set("Authorization", `Bearer ${users[0].token}`)
      .expect(200);

    expect(res.body.leagueId).toBe(league.id);
    expect(res.body.standings).toHaveLength(4);
    expect(res.body.standings[0].rank).toBe(1);
    expect(res.body.standings[0].totalScore).toBe(800);
  });

  it("includes userEntry for the requesting user", async () => {
    const res = await supertest(app.server)
      .get(`/leagues/${league.id}/standings`)
      .set("Authorization", `Bearer ${users[2].token}`)
      .expect(200);

    expect(res.body.userEntry).toBeDefined();
    expect(res.body.userEntry.userId).toBe(users[2].id);
    expect(res.body.userEntry.rank).toBe(4);
  });
});

describe("GET /leagues/:id/standings?period=all_time", () => {
  it("returns all-time standings aggregating all months", async () => {
    const res = await supertest(app.server)
      .get(`/leagues/${league.id}/standings?period=all_time`)
      .set("Authorization", `Bearer ${users[0].token}`)
      .expect(200);

    expect(res.body.period).toBe("all_time");
    expect(res.body.month).toBeUndefined();
    expect(res.body.standings).toHaveLength(4);
    expect(res.body.standings[0].rank).toBe(1);
  });
});

describe("GET /leagues/global/standings", () => {
  it("returns global standings with percentile", async () => {
    const res = await supertest(app.server)
      .get("/leagues/global/standings")
      .set("Authorization", `Bearer ${users[0].token}`)
      .expect(200);

    expect(res.body.period).toBe("current");
    expect(res.body.standings.length).toBeGreaterThan(0);
    if (res.body.userEntry) {
      expect(res.body.userEntry).toHaveProperty("percentile");
    }
  });
});
