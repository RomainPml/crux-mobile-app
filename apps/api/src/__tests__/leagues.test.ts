import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();
let tokenA: string;
let tokenB: string;
let userIdA: string;

beforeAll(async () => {
  await app.ready();

  const resA = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: `league-test-user-a-${Date.now()}` });
  tokenA = resA.body.token;
  userIdA = resA.body.userId;

  const resB = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: `league-test-user-b-${Date.now()}` });
  tokenB = resB.body.token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /leagues", () => {
  it("creates a league and returns a 6-char code", async () => {
    const res = await supertest(app.server)
      .post("/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Ma Ligue Test" })
      .expect(200);

    expect(res.body).toHaveProperty("leagueId");
    expect(res.body.name).toBe("Ma Ligue Test");
    expect(res.body.code).toHaveLength(6);
    // No ambiguous chars
    expect(res.body.code).not.toMatch(/[0O1I]/);
  });

  it("creator is auto-joined as admin", async () => {
    const res = await supertest(app.server)
      .post("/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Admin Check League" })
      .expect(200);

    const membership = await prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId: res.body.leagueId, userId: userIdA } },
    });

    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("ADMIN");
  });
});

describe("POST /leagues/join", () => {
  it("joins a league by code", async () => {
    // Create a league first
    const createRes = await supertest(app.server)
      .post("/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Join Test League" });

    const code = createRes.body.code;

    // User B joins
    const joinRes = await supertest(app.server)
      .post("/leagues/join")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ code })
      .expect(200);

    expect(joinRes.body.leagueId).toBe(createRes.body.leagueId);
    expect(joinRes.body.name).toBe("Join Test League");
  });

  it("is idempotent (joining twice returns same result)", async () => {
    const createRes = await supertest(app.server)
      .post("/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Idempotent Join" });

    const code = createRes.body.code;

    const join1 = await supertest(app.server)
      .post("/leagues/join")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ code })
      .expect(200);

    const join2 = await supertest(app.server)
      .post("/leagues/join")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ code })
      .expect(200);

    expect(join1.body.leagueId).toBe(join2.body.leagueId);
  });

  it("returns 404 for invalid code", async () => {
    await supertest(app.server)
      .post("/leagues/join")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ code: "ZZZZZZ" })
      .expect(404);
  });
});

describe("GET /me/leagues", () => {
  it("returns user leagues with current rank and member count", async () => {
    const res = await supertest(app.server)
      .get("/me/leagues")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toHaveProperty("leagues");
    expect(res.body.leagues.length).toBeGreaterThan(0);

    // Should include at least the global league
    const global = res.body.leagues.find((l: any) => l.type === "global");
    expect(global).toBeDefined();
    expect(global.code).toBe("GLOBAL");

    // Every league should have required fields
    for (const l of res.body.leagues) {
      expect(l).toHaveProperty("leagueId");
      expect(l).toHaveProperty("name");
      expect(l).toHaveProperty("code");
      expect(l).toHaveProperty("type");
      expect(l).toHaveProperty("memberCount");
      expect(typeof l.memberCount).toBe("number");
    }
  });
});
