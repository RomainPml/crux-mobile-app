import { currentMonth } from "@crux/shared";
import { rolloverMonth } from "./rollover.js";

const ONE_HOUR = 60 * 60 * 1000;

let cronTimer: ReturnType<typeof setInterval> | null = null;

/** Start a simple in-process cron that checks for month rollover every hour.
 *  On the 1st of each month, it rolls over the previous month. */
export function startRolloverCron() {
  async function check() {
    const now = new Date();
    if (now.getDate() <= 1 && now.getHours() < 6) {
      // It's the 1st of the month, before 6 AM — run rollover for previous month
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

      console.log(`[cron] Running month rollover for ${prevMonth}`);
      try {
        await rolloverMonth(prevMonth);
        console.log(`[cron] Rollover complete for ${prevMonth}`);
      } catch (err) {
        console.error(`[cron] Rollover failed for ${prevMonth}:`, err);
      }
    }
  }

  // Run immediately on startup, then every hour
  check();
  cronTimer = setInterval(check, ONE_HOUR);
  console.log("[cron] Rollover cron started (checks every hour)");
}

export function stopRolloverCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
}
