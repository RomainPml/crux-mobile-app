import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AnonAuthRequestSchema } from "@crux/shared";
import { prisma } from "./db.js";

function hashDeviceKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/anon", async (request, reply) => {
    const body = AnonAuthRequestSchema.parse(request.body);
    const hash = hashDeviceKey(body.deviceKey);

    let user = await prisma.user.findUnique({
      where: { deviceKeyHash: hash },
    });

    if (!user) {
      try {
        user = await prisma.user.create({
          data: { deviceKeyHash: hash },
        });
      } catch (e: any) {
        if (e.code === "P2002") {
          user = await prisma.user.findUniqueOrThrow({
            where: { deviceKeyHash: hash },
          });
        } else throw e;
      }

      // Auto-join global league (idempotent)
      const globalLeague = await prisma.league.findUnique({
        where: { code: "GLOBAL" },
      });
      if (globalLeague) {
        await prisma.membership.upsert({
          where: { leagueId_userId: { leagueId: globalLeague.id, userId: user.id } },
          create: { leagueId: globalLeague.id, userId: user.id },
          update: {},
        });
      }
    }

    const token = app.jwt.sign({ sub: user.id }, { expiresIn: "90d" });

    return { token, userId: user.id };
  });
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}
