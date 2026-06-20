import type { FastifyRequest, FastifyReply } from "fastify";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "test-admin-key";

export async function authenticateAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const key = request.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return reply.code(403).send({ error: "Forbidden" });
  }
}
