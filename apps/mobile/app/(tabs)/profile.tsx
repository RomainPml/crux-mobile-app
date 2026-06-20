import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Alert } from "react-native";
import { useState } from "react";
import { useProfile, useUpdateProfile } from "../../lib/hooks";
import { COLORS, SPACING, FONT, RADIUS } from "../../lib/theme";

export default function ProfileScreen() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [pseudoInput, setPseudoInput] = useState("");

  if (profile.isLoading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} /></View>;
  }

  if (profile.error || !profile.data) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Erreur de chargement</Text>
        <Pressable style={s.retryBtn} onPress={() => profile.refetch()}>
          <Text style={s.retryBtnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  const { pseudo, badges, monthlyHistory } = profile.data;
  const initials = (pseudo ?? "?").slice(0, 2).toUpperCase();

  const handleSavePseudo = () => {
    if (pseudoInput.length < 2 || pseudoInput.length > 20) {
      Alert.alert("", "Le pseudo doit faire entre 2 et 20 caracteres");
      return;
    }
    updateProfile.mutate(
      { pseudo: pseudoInput },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => Alert.alert("", e.message.includes("409") ? "Pseudo deja pris" : "Erreur"),
      },
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Avatar */}
      <View style={s.avatarContainer}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        {editing ? (
          <View style={s.editRow}>
            <TextInput
              style={s.editInput}
              value={pseudoInput}
              onChangeText={setPseudoInput}
              placeholder="Pseudo"
              placeholderTextColor={COLORS.textMuted}
              maxLength={20}
              autoFocus
            />
            <Pressable style={s.editBtn} onPress={handleSavePseudo}>
              <Text style={s.editBtnText}>{updateProfile.isPending ? "..." : "OK"}</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={s.cancelText}>Annuler</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => { setPseudoInput(pseudo ?? ""); setEditing(true); }}>
            <Text style={s.pseudo}>{pseudo ?? "Joueur anonyme"}</Text>
            <Text style={s.editHint}>{pseudo ? "Modifier" : "Choisir un pseudo"}</Text>
          </Pressable>
        )}
      </View>

      {/* Badges */}
      <Text style={s.section}>Badges ({badges.length})</Text>
      {badges.length === 0 ? (
        <Text style={s.empty}>Aucun badge pour le moment</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.badgeScroll}>
          {badges.map((b) => (
            <View key={`${b.code}-${b.awardedAt}`} style={s.badgeChip}>
              <Text style={s.badgeName}>{b.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* History */}
      <Text style={s.section}>Historique ({monthlyHistory.length})</Text>
      {monthlyHistory.length === 0 ? (
        <Text style={s.empty}>Pas encore d'historique</Text>
      ) : (
        monthlyHistory.map((h) => {
          const medal = h.finalRank === 1 ? "🥇" : h.finalRank === 2 ? "🥈" : h.finalRank === 3 ? "🥉" : "";
          return (
            <View key={`${h.month}-${h.leagueId}`} style={s.historyCard}>
              <View style={s.historyRow}>
                <Text style={s.historyMonth}>{h.month}</Text>
                <Text style={s.historyRank}>{medal} #{h.finalRank}</Text>
              </View>
              <Text style={s.historyMeta}>
                {h.leagueName} — {h.finalScore} pts — {h.membersCount} membres
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", gap: SPACING.md },
  avatarContainer: { alignItems: "center", marginBottom: SPACING.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent,
    justifyContent: "center", alignItems: "center", marginBottom: SPACING.md,
  },
  avatarText: { color: "#fff", fontSize: FONT.xxl, fontWeight: "700" },
  pseudo: { fontSize: FONT.xl, fontWeight: "700", color: COLORS.textPrimary, textAlign: "center" },
  editHint: { color: COLORS.accentLight, fontSize: FONT.sm, textAlign: "center", marginTop: SPACING.xs },
  editRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  editInput: {
    backgroundColor: COLORS.bgInput, color: COLORS.textPrimary, fontSize: FONT.lg,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, minWidth: 150,
    borderWidth: 1, borderColor: COLORS.border,
  },
  editBtn: { backgroundColor: COLORS.accent, paddingVertical: 8, paddingHorizontal: 16, borderRadius: RADIUS.md },
  editBtnText: { color: "#fff", fontWeight: "600" },
  cancelText: { color: COLORS.textMuted, fontSize: FONT.sm, paddingHorizontal: SPACING.sm },
  section: {
    fontSize: FONT.lg, fontWeight: "600", color: COLORS.textPrimary,
    marginTop: SPACING.xl, marginBottom: SPACING.md,
  },
  empty: { color: COLORS.textMuted, fontSize: FONT.sm },
  badgeScroll: { marginBottom: SPACING.sm },
  badgeChip: {
    backgroundColor: COLORS.bgCard, paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: RADIUS.xl, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  badgeName: { color: COLORS.textPrimary, fontSize: FONT.sm, fontWeight: "500" },
  historyCard: {
    backgroundColor: COLORS.bgCard, padding: SPACING.md, borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyMonth: { fontSize: FONT.md, fontWeight: "600", color: COLORS.textPrimary },
  historyRank: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.accent },
  historyMeta: { fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  errorText: { fontSize: FONT.md, color: COLORS.textSecondary },
  retryBtn: { backgroundColor: COLORS.accent, paddingVertical: 10, paddingHorizontal: 24, borderRadius: RADIUS.md },
  retryBtnText: { color: "#fff", fontWeight: "600" },
});
