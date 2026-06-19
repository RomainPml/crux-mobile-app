import { buildApp } from "./app.js";
import { startRolloverCron } from "./cron.js";

const app = buildApp();

const start = async () => {
  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: "0.0.0.0" });
  startRolloverCron();
};

start();
