import { PrismaClient, LeagueType, MemberRole } from "@prisma/client";

const prisma = new PrismaClient();

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

  console.log("Seed complete:", { badges: badges.length, globalLeagueId: globalLeague.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
