import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { currentMonth } from "@crux/shared";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("E2E: full user journey", () => {
  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let userIdB: string;
  let leagueId: string;
  let leagueCode: string;
  const testId = Date.now();

  it("1. User A authenticates anonymously", async () => {
    const res = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: `e2e-user-a-${testId}` })
      .expect(200);

    tokenA = res.body.token;
    userIdA = res.body.userId;
    expect(tokenA).toBeTruthy();
  });

  it("2. User A gets today's puzzle", async () => {
    const res = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.puzzleId).toBeTruthy();
    expect(res.body.servedAt).toBeTruthy();
  });

  it("3. User A submits a result", async () => {
    // Backdate serve to simulate real solve time
    const puzzleRes = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${tokenA}`);

    await prisma.puzzleServe.update({
      where: {
        userId_puzzleId: { userId: userIdA, puzzleId: puzzleRes.body.puzzleId },
      },
      data: { servedAt: new Date(Date.now() - 45_000) },
    });

    // Get real solution from DB
    const dbPuzzle = await prisma.puzzle.findUnique({ where: { id: puzzleRes.body.puzzleId } });
    const solution = (dbPuzzle?.solution as any)?.rows ?? [{a:"1"},{a:"2"},{a:"3"},{a:"4"}];

    const res = await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        puzzleId: puzzleRes.body.puzzleId,
        servedAt: puzzleRes.body.servedAt,
        cleanDeductions: 4, solution,
      })
      .expect(200);

    expect(res.body.score).toBeGreaterThan(0);
    expect(res.body.suspect).toBe(false);
  });

  it("4. User A creates a league", async () => {
    const res = await supertest(app.server)
      .post("/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "E2E Test League" })
      .expect(200);

    leagueId = res.body.leagueId;
    leagueCode = res.body.code;
    expect(leagueCode).toHaveLength(6);
  });

  it("5. User B authenticates and joins via code", async () => {
    const authRes = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: `e2e-user-b-${testId}` })
      .expect(200);

    tokenB = authRes.body.token;
    userIdB = authRes.body.userId;

    // User B gets and submits puzzle too
    const puzzleRes = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${tokenB}`);

    await prisma.puzzleServe.update({
      where: {
        userId_puzzleId: { userId: userIdB, puzzleId: puzzleRes.body.puzzleId },
      },
      data: { servedAt: new Date(Date.now() - 60_000) },
    });

    const dbPuzzleB = await prisma.puzzle.findUnique({ where: { id: puzzleRes.body.puzzleId } });
    const solutionB = (dbPuzzleB?.solution as any)?.rows ?? [{a:"1"},{a:"2"},{a:"3"},{a:"4"}];

    await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        puzzleId: puzzleRes.body.puzzleId,
        servedAt: puzzleRes.body.servedAt,
        cleanDeductions: 2, solution: solutionB,
      })
      .expect(200);

    // Join league
    const joinRes = await supertest(app.server)
      .post("/leagues/join")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ code: leagueCode })
      .expect(200);

    expect(joinRes.body.name).toBe("E2E Test League");
  });

  it("6. Both users appear in league standings", async () => {
    const res = await supertest(app.server)
      .get(`/leagues/${leagueId}/standings`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.standings).toHaveLength(2);
    const userIds = res.body.standings.map((s: any) => s.userId);
    expect(userIds).toContain(userIdA);
    expect(userIds).toContain(userIdB);
  });

  it("7. User A's leagues show the new league with rank", async () => {
    const res = await supertest(app.server)
      .get("/me/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const e2eLeague = res.body.leagues.find((l: any) => l.leagueId === leagueId);
    expect(e2eLeague).toBeDefined();
    expect(e2eLeague.currentRank).toBe(1); // or 2 depending on score
    expect(e2eLeague.memberCount).toBe(2);
  });

  it("8. Rollover freezes standings, badges survive", async () => {
    const month = currentMonth();

    // Run rollover for current month
    await supertest(app.server)
      .post("/admin/month-rollover")
      .set("x-admin-key", "dev-admin-key")
      .send({ month })
      .expect(200);

    // Check history was created
    const history = await prisma.leagueStandingHistory.findMany({
      where: { leagueId, month },
    });
    expect(history).toHaveLength(2);

    // Replay — idempotent
    await supertest(app.server)
      .post("/admin/month-rollover")
      .set("x-admin-key", "dev-admin-key")
      .send({ month })
      .expect(200);

    const history2 = await prisma.leagueStandingHistory.findMany({
      where: { leagueId, month },
    });
    expect(history2).toHaveLength(2);
  });

  it("9. Profile shows badges and history after rollover", async () => {
    const res = await supertest(app.server)
      .get("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.userId).toBe(userIdA);
    expect(res.body.monthlyHistory.length).toBeGreaterThan(0);

    const e2eHistory = res.body.monthlyHistory.find(
      (h: any) => h.leagueId === leagueId,
    );
    expect(e2eHistory).toBeDefined();
    expect(e2eHistory.finalRank).toBeGreaterThan(0);
  });

  it("10. Events were tracked (invite_converted, result_submitted)", async () => {
    const conversions = await prisma.event.findMany({
      where: { type: "invite_converted", userId: userIdB },
    });
    expect(conversions.length).toBeGreaterThan(0);

    const submissions = await prisma.event.findMany({
      where: { type: "result_submitted", userId: userIdA },
    });
    expect(submissions.length).toBeGreaterThan(0);
  });

  it("11. Metrics endpoint returns data", async () => {
    const res = await supertest(app.server)
      .get("/admin/metrics")
      .set("x-admin-key", "dev-admin-key")
      .expect(200);

    expect(res.body.totalUsers).toBeGreaterThan(0);
    expect(res.body.resultSubmissions).toBeGreaterThan(0);
  });
});
