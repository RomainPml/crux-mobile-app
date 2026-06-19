import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { authRoutes } from "./auth.js";
import { puzzleRoutes } from "./puzzle.js";
import { resultRoutes } from "./results.js";
import { standingsRoutes } from "./standings.js";
import { leagueRoutes } from "./leagues.js";
import { rolloverRoutes } from "./rollover.js";
import { profileRoutes } from "./profile.js";
import { eventRoutes } from "./events.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: ["127.0.0.1", "::1"],
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation error",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    const err = error as Error & { statusCode?: number };
    reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(authRoutes);
  app.register(puzzleRoutes);
  app.register(resultRoutes);
  app.register(standingsRoutes);
  app.register(leagueRoutes);
  app.register(rolloverRoutes);
  app.register(profileRoutes);
  app.register(eventRoutes);

  return app;
}
