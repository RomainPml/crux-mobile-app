import { todayDate, currentMonth } from "@crux/shared";
import { rolloverMonth } from "./rollover.js";

const ONE_HOUR = 60 * 60 * 1000;

let cronTimer: ReturnType<typeof setInterval> | null = null;

export function startRolloverCron() {
  async function check() {
    const now = new Date();
    // Use Europe/Paris timezone for day/month boundaries
    const today = todayDate(now);
    const day = parseInt(today.split("-")[2], 10);

    if (day === 1) {
      // Compute previous month in Europe/Paris timezone
      const prevDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
      const prevMonth = currentMonth(prevDate);

      console.log(`[cron] Running month rollover for ${prevMonth}`);
      try {
        await rolloverMonth(prevMonth);
        console.log(`[cron] Rollover complete for ${prevMonth}`);
      } catch (err) {
        console.error(`[cron] Rollover failed for ${prevMonth}:`, err);
      }
    }
  }

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
