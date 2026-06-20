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
      user = await prisma.user.create({
        data: { deviceKeyHash: hash },
      });

      // Auto-join global league
      const globalLeague = await prisma.league.findUnique({
        where: { code: "GLOBAL" },
      });
      if (globalLeague) {
        await prisma.membership.create({
          data: {
            leagueId: globalLeague.id,
            userId: user.id,
          },
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
