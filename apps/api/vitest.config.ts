import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    env: {
      DATABASE_URL: `postgresql://romainpaumelle@localhost:5432/crux?schema=public`,
      JWT_SECRET: "dev-secret-change-me",
      ADMIN_API_KEY: "dev-admin-key",
    },
  },
});
