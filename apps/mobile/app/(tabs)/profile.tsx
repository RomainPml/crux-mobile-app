import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Alert } from "react-native";
import { useState } from "react";
import { useProfile, useUpdateProfile } from "../../lib/hooks";

export default function ProfileScreen() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [pseudoInput, setPseudoInput] = useState("");

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
        <Pressable style={styles.btn} onPress={() => profile.refetch()}>
          <Text style={styles.btnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  const { pseudo, badges, monthlyHistory } = profile.data;

  const handleSavePseudo = () => {
    if (pseudoInput.length < 2 || pseudoInput.length > 20) {
      Alert.alert("Erreur", "Le pseudo doit faire entre 2 et 20 caracteres");
      return;
    }
    updateProfile.mutate(
      { pseudo: pseudoInput },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => Alert.alert("Erreur", e.message.includes("409") ? "Ce pseudo est deja pris" : "Erreur"),
      },
    );
  };

  const startEdit = () => {
    setPseudoInput(pseudo || "");
    setEditing(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={pseudoInput}
            onChangeText={setPseudoInput}
            placeholder="Votre pseudo"
            maxLength={20}
            autoFocus
          />
          <Pressable style={styles.btnSmall} onPress={handleSavePseudo}>
            <Text style={styles.btnText}>{updateProfile.isPending ? "..." : "OK"}</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={startEdit}>
          <Text style={styles.title}>{pseudo || "Joueur anonyme"}</Text>
          <Text style={styles.editHint}>{pseudo ? "Modifier le pseudo" : "Choisir un pseudo"}</Text>
        </Pressable>
      )}

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
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "bold" },
  editHint: { color: "#007AFF", fontSize: 14, marginTop: 4, marginBottom: 24 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
  },
  btn: { backgroundColor: "#007AFF", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  btnSmall: { backgroundColor: "#007AFF", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
  cancelText: { color: "#888", fontSize: 14, paddingHorizontal: 8 },
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
