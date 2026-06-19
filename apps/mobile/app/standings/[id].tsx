import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useStandings } from "../../lib/hooks";

export default function StandingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const standings = useStandings(id);

  if (standings.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (standings.error || !standings.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Erreur de chargement</Text>
      </View>
    );
  }

  const { standings: entries, userEntry, month } = standings.data;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Classement</Text>
      <Text style={styles.month}>{month}</Text>

      {userEntry && (
        <View style={styles.userCard}>
          <Text style={styles.userRank}>#{userEntry.rank}</Text>
          <Text style={styles.userScore}>{userEntry.totalScore} pts</Text>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              userEntry?.userId === item.userId && styles.rowHighlight,
            ]}
          >
            <Text style={styles.rank}>#{item.rank}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.pseudo || "Anonyme"}
            </Text>
            <Text style={styles.score}>{item.totalScore}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold" },
  month: { fontSize: 14, color: "#888", marginBottom: 16 },
  userCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#E8F0FE",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  userRank: { fontSize: 22, fontWeight: "bold", color: "#007AFF" },
  userScore: { fontSize: 18, fontWeight: "600" },
  list: { gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  },
  rowHighlight: { backgroundColor: "#E8F0FE" },
  rank: { width: 40, fontSize: 15, fontWeight: "600", color: "#888" },
  name: { flex: 1, fontSize: 15 },
  score: { fontSize: 15, fontWeight: "600" },
  error: { fontSize: 16, color: "red" },
});
