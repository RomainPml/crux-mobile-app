import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useStandings } from "../../lib/hooks";
import { COLORS, SPACING, FONT, RADIUS } from "../../lib/theme";

const MEDALS = ["", "🥇", "🥈", "🥉"];

export default function StandingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const standings = useStandings(id);

  if (standings.isLoading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} /></View>;
  }

  if (standings.error || !standings.data) {
    return <View style={s.center}><Text style={s.errorText}>Erreur</Text></View>;
  }

  const { standings: entries, userEntry, month } = standings.data;

  return (
    <View style={s.container}>
      {month && <Text style={s.month}>{month}</Text>}

      {/* User card */}
      {userEntry && (
        <View style={s.userCard}>
          <Text style={s.userRank}>#{userEntry.rank}</Text>
          <Text style={s.userName}>{userEntry.pseudo ?? "Vous"}</Text>
          <Text style={s.userScore}>{userEntry.totalScore} pts</Text>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={s.list}
        onRefresh={() => standings.refetch()}
        refreshing={standings.isFetching}
        renderItem={({ item, index }) => {
          const isUser = userEntry?.userId === item.userId;
          const medal = MEDALS[item.rank] ?? "";
          return (
            <View style={[s.row, index % 2 === 0 && s.rowAlt, isUser && s.rowHighlight]}>
              <Text style={s.rowRank}>{medal || `#${item.rank}`}</Text>
              <Text style={s.rowName} numberOfLines={1}>{item.pseudo || "Anonyme"}</Text>
              <Text style={s.rowScore}>{item.totalScore}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" },
  month: { fontSize: FONT.sm, color: COLORS.textSecondary, textAlign: "center", marginBottom: SPACING.md },
  userCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.accent, padding: SPACING.md, borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  userRank: { fontSize: FONT.xl, fontWeight: "700", color: "#fff" },
  userName: { fontSize: FONT.md, color: "rgba(255,255,255,0.8)", flex: 1, marginLeft: SPACING.md },
  userScore: { fontSize: FONT.lg, fontWeight: "600", color: "#fff" },
  list: { gap: 2, paddingBottom: SPACING.xxl },
  row: {
    flexDirection: "row", alignItems: "center", padding: SPACING.md,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.bg,
  },
  rowAlt: { backgroundColor: COLORS.bgCard },
  rowHighlight: { backgroundColor: COLORS.accentDark, borderRadius: RADIUS.md },
  rowRank: { width: 44, fontSize: FONT.md, fontWeight: "600", color: COLORS.textSecondary },
  rowName: { flex: 1, fontSize: FONT.md, color: COLORS.textPrimary },
  rowScore: { fontSize: FONT.md, fontWeight: "600", color: COLORS.textPrimary, fontVariant: ["tabular-nums"] },
  errorText: { fontSize: FONT.md, color: COLORS.textSecondary },
});
