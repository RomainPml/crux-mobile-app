import { PrismaClient, LeagueType } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function hash(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

const PSEUDOS = [
  "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hector",
  "Iris", "Jules", "Kara", "Leo", "Mia", "Noah", "Olivia", "Paul",
  "Quinn", "Rosa", "Sam", "Tina", "Ugo", "Vera", "Will", "Xena",
  "Yann", "Zoe", "Axel", "Bella", "Cleo", "Dani",
];

async function main() {
  // Badge catalogue
  const badges = [
    { code: "podium_mensuel", name: "Podium mensuel", description: "Top 3 du classement mensuel", criteria: "final_rank <= 3" },
    { code: "champion_mensuel", name: "Champion mensuel", description: "1er du classement mensuel (ligue >= 10 membres)", criteria: "final_rank == 1 && members_count >= 10" },
    { code: "serie_7", name: "Serie de 7", description: "7 jours consecutifs joues", criteria: "consecutive_days >= 7" },
    { code: "serie_30", name: "Serie de 30", description: "30 jours consecutifs joues", criteria: "consecutive_days >= 30" },
    { code: "sans_faute", name: "Sans faute", description: "Puzzle complete sans erreur", criteria: "clean_deductions == total_deductions" },
    { code: "pionnier", name: "Pionnier", description: "Createur d'une ligue ayant atteint 10 membres", criteria: "owned_league_members >= 10" },
  ];

  for (const b of badges) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });
  }

  // Global league
  const globalLeague = await prisma.league.upsert({
    where: { code: "GLOBAL" },
    update: {},
    create: {
      name: "Classement Global",
      code: "GLOBAL",
      type: LeagueType.GLOBAL,
    },
  });

  // Private leagues
  const league1 = await prisma.league.upsert({
    where: { code: "ALPHAS" },
    update: {},
    create: { name: "Les Alphas", code: "ALPHAS", type: LeagueType.PRIVATE },
  });

  const league2 = await prisma.league.upsert({
    where: { code: "BRAVOS" },
    update: {},
    create: { name: "Team Bravo", code: "BRAVOS", type: LeagueType.PRIVATE },
  });

  // Create 30 fictitious users
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

  const userIds: string[] = [];

  for (let i = 0; i < 30; i++) {
    const user = await prisma.user.upsert({
      where: { deviceKeyHash: hash(`seed-device-${i}`) },
      update: {},
      create: {
        deviceKeyHash: hash(`seed-device-${i}`),
        pseudo: PSEUDOS[i],
        createdAt: new Date(now.getTime() - (30 - i) * 86_400_000),
      },
    });
    userIds.push(user.id);

    // Join global league
    await prisma.membership.upsert({
      where: { leagueId_userId: { leagueId: globalLeague.id, userId: user.id } },
      update: {},
      create: { leagueId: globalLeague.id, userId: user.id },
    });

    // First 15 in league1, next 15 in league2
    const privateLeague = i < 15 ? league1 : league2;
    await prisma.membership.upsert({
      where: { leagueId_userId: { leagueId: privateLeague.id, userId: user.id } },
      update: {},
      create: { leagueId: privateLeague.id, userId: user.id },
    });
  }

  // Set league owners
  await prisma.league.update({ where: { id: league1.id }, data: { ownerId: userIds[0] } });
  await prisma.league.update({ where: { id: league2.id }, data: { ownerId: userIds[15] } });

  // Create puzzles for the last 30 days
  const puzzleIds: string[] = [];
  for (let d = 30; d >= 1; d--) {
    const day = new Date(now.getTime() - d * 86_400_000);
    day.setHours(0, 0, 0, 0);
    const puzzle = await prisma.puzzle.upsert({
      where: { day },
      update: {},
      create: { day, difficulty: 1 + (d % 5) },
    });
    puzzleIds.push(puzzle.id);
  }

  // Generate daily results for the previous month
  // Each user plays 15-28 days randomly, with varying scores
  for (let i = 0; i < 30; i++) {
    const userId = userIds[i];
    const daysPlayed = 15 + Math.floor(Math.abs(Math.sin(i * 7)) * 13);
    let totalScore = 0;
    let totalTime = 0;
    let puzzlesPlayed = 0;

    for (let d = 0; d < Math.min(daysPlayed, puzzleIds.length); d++) {
      const timeMs = 20_000 + Math.floor(Math.abs(Math.sin(i * 13 + d * 7)) * 250_000);
      const cleanDeductions = Math.floor(Math.abs(Math.cos(i * 3 + d)) * 5);
      const maxTime = 5 * 60 * 1000;
      const speedScore = Math.max(0, Math.round(1000 * (1 - timeMs / maxTime)));
      const cleanBonus = Math.min(cleanDeductions * 100, 500);
      const score = speedScore + cleanBonus;

      const servedAt = new Date(now.getTime() - (30 - d) * 86_400_000 + 8 * 3_600_000);
      const submittedAt = new Date(servedAt.getTime() + timeMs);

      await prisma.dailyResult.upsert({
        where: { userId_puzzleId: { userId, puzzleId: puzzleIds[d] } },
        update: {},
        create: {
          userId,
          puzzleId: puzzleIds[d],
          score,
          timeMs,
          cleanDeductions,
          servedAt,
          submittedAt,
          suspect: false,
        },
      });

      totalScore += score;
      totalTime += timeMs;
      puzzlesPlayed++;
    }

    // Monthly score for previous month
    await prisma.monthlyScore.upsert({
      where: { userId_month: { userId, month: prevMonth } },
      update: { totalScore, puzzlesPlayed, cumulativeTimeMs: totalTime },
      create: { userId, month: prevMonth, totalScore, puzzlesPlayed, cumulativeTimeMs: totalTime },
    });

    // Also create a partial current month score (first few days)
    const currentDays = Math.min(5, puzzlesPlayed);
    const currentScore = Math.round(totalScore * (currentDays / puzzlesPlayed));
    const currentTime = Math.round(totalTime * (currentDays / puzzlesPlayed));
    await prisma.monthlyScore.upsert({
      where: { userId_month: { userId, month: currentMonth } },
      update: { totalScore: currentScore, puzzlesPlayed: currentDays, cumulativeTimeMs: currentTime },
      create: { userId, month: currentMonth, totalScore: currentScore, puzzlesPlayed: currentDays, cumulativeTimeMs: currentTime },
    });
  }

  console.log("Seed complete:", {
    badges: badges.length,
    users: 30,
    puzzles: puzzleIds.length,
    leagues: 3,
    months: [prevMonth, currentMonth],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
