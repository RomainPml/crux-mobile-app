import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

const app = buildApp();
let token: string;

beforeAll(async () => {
  await app.ready();
  const res = await supertest(app.server)
    .post("/auth/anon")
    .send({ deviceKey: "events-test-device-key-1234" });
  token = res.body.token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /events", () => {
  it("records a share_emitted event", async () => {
    const res = await supertest(app.server)
      .post("/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "share_emitted", payload: { leagueCode: "ABC123" } })
      .expect(200);

    expect(res.body.ok).toBe(true);

    const event = await prisma.event.findFirst({
      where: { type: "share_emitted" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
  });

  it("records an invite_clicked event", async () => {
    await supertest(app.server)
      .post("/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "invite_clicked", payload: { code: "XYZ789" } })
      .expect(200);
  });

  it("rejects invalid event types", async () => {
    const res = await supertest(app.server)
      .post("/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "hacker_event" })
      .expect(200);

    expect(res.body.error).toBe("Invalid event type");
  });
});

describe("GET /admin/metrics", () => {
  it("returns aggregated metrics", async () => {
    const res = await supertest(app.server)
      .get("/admin/metrics")
      .set("x-admin-key", "dev-admin-key")
      .expect(200);

    expect(res.body).toHaveProperty("shares");
    expect(res.body).toHaveProperty("inviteClicks");
    expect(res.body).toHaveProperty("inviteConversions");
    expect(res.body).toHaveProperty("conversionRate");
    expect(res.body).toHaveProperty("resultSubmissions");
    expect(res.body).toHaveProperty("totalUsers");
    expect(res.body).toHaveProperty("activeUsersToday");
    expect(res.body).toHaveProperty("retentionD1");
    expect(res.body.period).toBe("last_24h");
  });
});
