import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp({ skipEnvCheck: true });
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  await app.ready();
  const resA = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: `pseudo-test-a-${Math.floor(Date.now()/1000) % 100000}` });
  tokenA = resA.body.token;

  const resB = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: `pseudo-test-b-${Math.floor(Date.now()/1000) % 100000}` });
  tokenB = resB.body.token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("PATCH /me/profile", () => {
  it("sets a pseudo", async () => {
    const pseudo = `TestUser_${Math.floor(Date.now()/1000) % 100000}`;
    const res = await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo })
      .expect(200);

    expect(res.body.pseudo).toBe(pseudo);
  });

  it("rejects short pseudo", async () => {
    await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo: "a" })
      .expect(400);
  });

  it("rejects invalid characters", async () => {
    await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo: "test user!" })
      .expect(400);
  });

  it("rejects duplicate pseudo (case-insensitive)", async () => {
    const pseudo = `Unique_${Math.floor(Date.now()/1000) % 100000}`;

    await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo })
      .expect(200);

    await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ pseudo: pseudo.toLowerCase() })
      .expect(409);
  });

  it("allows user to update their own pseudo", async () => {
    const pseudo1 = `Update1_${Math.floor(Date.now()/1000) % 100000}`;
    const pseudo2 = `Update2_${Math.floor(Date.now()/1000) % 100000}`;

    await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo: pseudo1 })
      .expect(200);

    const res = await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo: pseudo2 })
      .expect(200);

    expect(res.body.pseudo).toBe(pseudo2);
  });

  it("pseudo appears in profile", async () => {
    const pseudo = `Profile_${Math.floor(Date.now()/1000) % 100000}`;
    await supertest(app.server)
      .patch("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ pseudo });

    const res = await supertest(app.server)
      .get("/me/profile")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.pseudo).toBe(pseudo);
  });
});
