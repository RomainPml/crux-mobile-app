import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useProfile } from "../../lib/hooks";

export default function ProfileScreen() {
  const profile = useProfile();

  if (profile.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Erreur de chargement</Text>
        <Pressable style={{ backgroundColor: "#007AFF", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }} onPress={() => profile.refetch()}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  const { pseudo, badges, monthlyHistory } = profile.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{pseudo || "Joueur anonyme"}</Text>

      <Text style={styles.section}>Badges ({badges.length})</Text>
      {badges.length === 0 ? (
        <Text style={styles.empty}>Aucun badge pour le moment</Text>
      ) : (
        badges.map((b) => (
          <View key={`${b.code}-${b.awardedAt}`} style={styles.badgeCard}>
            <Text style={styles.badgeName}>{b.name}</Text>
            <Text style={styles.badgeDesc}>{b.description}</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>Historique ({monthlyHistory.length})</Text>
      {monthlyHistory.length === 0 ? (
        <Text style={styles.empty}>Pas encore d'historique</Text>
      ) : (
        monthlyHistory.map((h) => (
          <View key={`${h.month}-${h.leagueId}`} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyMonth}>{h.month}</Text>
              <Text style={styles.historyRank}>#{h.finalRank}</Text>
            </View>
            <Text style={styles.historyMeta}>
              {h.leagueName} — {h.finalScore} pts — {h.membersCount} membres
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24 },
  section: { fontSize: 18, fontWeight: "600", marginTop: 24, marginBottom: 12 },
  empty: { color: "#aaa", fontSize: 14 },
  badgeCard: { backgroundColor: "#f0f0f0", padding: 12, borderRadius: 10, marginBottom: 8 },
  badgeName: { fontSize: 15, fontWeight: "600" },
  badgeDesc: { fontSize: 13, color: "#666", marginTop: 2 },
  historyCard: { backgroundColor: "#f9f9f9", padding: 12, borderRadius: 10, marginBottom: 8 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between" },
  historyMonth: { fontSize: 15, fontWeight: "600" },
  historyRank: { fontSize: 18, fontWeight: "bold", color: "#007AFF" },
  historyMeta: { fontSize: 13, color: "#888", marginTop: 4 },
  error: { fontSize: 16, color: "red" },
});
