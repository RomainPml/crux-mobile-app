import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
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

describe("POST /auth/anon", () => {
  it("creates a new user and returns a JWT", async () => {
    const res = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: "test-device-key-1234567890" })
      .expect(200);

    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("userId");
    expect(typeof res.body.token).toBe("string");
  });

  it("returns the same user for the same device key", async () => {
    const key = "idempotent-device-key-12345";

    const res1 = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: key })
      .expect(200);

    const res2 = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: key })
      .expect(200);

    expect(res1.body.userId).toBe(res2.body.userId);
  });

  it("auto-joins the global league", async () => {
    const res = await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: "global-league-test-key-123" })
      .expect(200);

    const membership = await prisma.membership.findFirst({
      where: { userId: res.body.userId },
      include: { league: true },
    });

    expect(membership).not.toBeNull();
    expect(membership!.league.code).toBe("GLOBAL");
  });

  it("rejects short device keys", async () => {
    await supertest(app.server)
      .post("/auth/anon")
      .send({ deviceKey: "short" })
      .expect(400); // Zod validation error
  });
});

describe("Health", () => {
  it("returns ok", async () => {
    const res = await supertest(app.server).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
