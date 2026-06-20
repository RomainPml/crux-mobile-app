import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();
let token: string;
let userId: string;

beforeAll(async () => {
  await app.ready();

  // Create a test user
  const res = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: "puzzle-test-device-key-123" });

  token = res.body.token;
  userId = res.body.userId;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /puzzles/today", () => {
  it("returns today's puzzle with servedAt", async () => {
    const res = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty("puzzleId");
    expect(res.body).toHaveProperty("day");
    expect(res.body).toHaveProperty("difficulty");
    expect(res.body).toHaveProperty("servedAt");
    expect(res.body.difficulty).toBe(3); // stub default
  });

  it("rejects unauthenticated requests", async () => {
    await supertest(app.server).get("/puzzles/today").expect(401);
  });
});

describe("POST /results", () => {
  it("submits a result with server-computed time", async () => {
    // First get the puzzle to record servedAt
    const puzzleRes = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    // Wait a bit to simulate solving
    await new Promise((r) => setTimeout(r, 100));

    const res = await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${token}`)
      .send({
        puzzleId: puzzleRes.body.puzzleId,
        servedAt: puzzleRes.body.servedAt,
        cleanDeductions: 3, solution: [{a:"1"},{a:"2"},{a:"3"},{a:"4"}],
      })
      .expect(200);

    expect(res.body).toHaveProperty("resultId");
    expect(res.body).toHaveProperty("score");
    expect(res.body).toHaveProperty("timeMs");
    expect(res.body.timeMs).toBeGreaterThanOrEqual(100);
    // Under 5s → suspect
    expect(res.body.suspect).toBe(true);
    expect(res.body.score).toBe(0);
  });

  it("is idempotent (same user + puzzle returns same result)", async () => {
    const puzzleRes = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${token}`);

    const res1 = await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${token}`)
      .send({
        puzzleId: puzzleRes.body.puzzleId,
        servedAt: puzzleRes.body.servedAt,
        cleanDeductions: 5, solution: [{a:"1"},{a:"2"},{a:"3"},{a:"4"}],
      })
      .expect(200);

    const res2 = await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${token}`)
      .send({
        puzzleId: puzzleRes.body.puzzleId,
        servedAt: puzzleRes.body.servedAt,
        cleanDeductions: 5, solution: [{a:"1"},{a:"2"},{a:"3"},{a:"4"}],
      })
      .expect(200);

    expect(res1.body.resultId).toBe(res2.body.resultId);
  });

  it("rejects result for unserved puzzle", async () => {
    await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${token}`)
      .send({
        puzzleId: "nonexistent-puzzle-id",
        servedAt: new Date().toISOString(),
        cleanDeductions: 0, solution: [{a:"1"},{a:"2"},{a:"3"},{a:"4"}],
      })
      .expect(404);
  });

  it("creates a monthly_score entry for non-suspect results", async () => {
    // Use a unique key per test run to avoid stale data
    const uniqueKey = `monthly-score-test-${Date.now()}`;
    const authRes = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: uniqueKey });

    const freshToken = authRes.body.token;
    const freshUserId = authRes.body.userId;

    // Get puzzle (records servedAt)
    const puzzleRes = await supertest(app.server)
      .get("/puzzles/today")
      .set("Authorization", `Bearer ${freshToken}`);

    // Manually backdate the serve record to simulate a longer solve time
    await prisma.puzzleServe.update({
      where: {
        userId_puzzleId: {
          userId: freshUserId,
          puzzleId: puzzleRes.body.puzzleId,
        },
      },
      data: { servedAt: new Date(Date.now() - 30_000) }, // 30s ago
    });

    const res = await supertest(app.server)
      .post("/results")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({
        puzzleId: puzzleRes.body.puzzleId,
        servedAt: puzzleRes.body.servedAt,
        cleanDeductions: 3, solution: [{a:"1"},{a:"2"},{a:"3"},{a:"4"}],
      })
      .expect(200);

    expect(res.body.suspect).toBe(false);
    expect(res.body.score).toBeGreaterThan(0);

    // Verify monthly_score was created
    const monthly = await prisma.monthlyScore.findFirst({
      where: { userId: freshUserId },
    });
    expect(monthly).not.toBeNull();
    expect(monthly!.totalScore).toBe(res.body.score);
    expect(monthly!.puzzlesPlayed).toBe(1);
  });
});
