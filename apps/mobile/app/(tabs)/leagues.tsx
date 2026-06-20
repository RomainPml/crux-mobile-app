import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, Alert, Share,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useMyLeagues, useCreateLeague, useJoinLeague } from "../../lib/hooks";
import { api } from "../../lib/api";
import { COLORS, SPACING, FONT, RADIUS } from "../../lib/theme";

export default function LeaguesScreen() {
  const leagues = useMyLeagues();
  const createLeague = useCreateLeague();
  const joinLeague = useJoinLeague();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    createLeague.mutate(
      { name: name.trim() },
      {
        onSuccess: (data) => {
          setShowCreate(false);
          setName("");
          Alert.alert("Ligue creee !", `Code : ${data.code}`);
        },
      },
    );
  };

  const handleJoin = () => {
    if (code.length !== 6) return;
    joinLeague.mutate(
      { code: code.toUpperCase() },
      {
        onSuccess: (data) => { setShowJoin(false); setCode(""); Alert.alert("Rejoint !", data.name); },
        onError: () => Alert.alert("Erreur", "Code invalide"),
      },
    );
  };

  const handleShare = async (leagueCode: string, leagueName: string) => {
    try {
      const result = await Share.share({
        message: `Rejoins ma ligue "${leagueName}" sur Crux !\nhttps://crux.app/l/${leagueCode}?name=${encodeURIComponent(leagueName)}`,
      });
      if (result.action === Share.sharedAction) {
        api.trackEvent("share_emitted", { leagueCode }).catch(() => {});
      }
    } catch {}
  };

  if (leagues.isLoading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} /></View>;
  }

  if (leagues.error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Erreur de chargement</Text>
        <Pressable style={s.retryBtn} onPress={() => leagues.refetch()}>
          <Text style={s.retryBtnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Mes Ligues</Text>

      <View style={s.actions}>
        <Pressable style={s.btnPrimary} onPress={() => setShowCreate(!showCreate)}>
          <Text style={s.btnPrimaryText}>+ Creer</Text>
        </Pressable>
        <Pressable style={s.btnOutline} onPress={() => setShowJoin(!showJoin)}>
          <Text style={s.btnOutlineText}>Rejoindre</Text>
        </Pressable>
      </View>

      {showCreate && (
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Nom de la ligue"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Pressable style={s.formBtn} onPress={handleCreate}>
            <Text style={s.btnPrimaryText}>Creer</Text>
          </Pressable>
        </View>
      )}

      {showJoin && (
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Code (6 car.)"
            placeholderTextColor={COLORS.textMuted}
            value={code}
            onChangeText={setCode}
            maxLength={6}
            autoCapitalize="characters"
          />
          <Pressable style={s.formBtn} onPress={handleJoin}>
            <Text style={s.btnPrimaryText}>OK</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={leagues.data?.leagues ?? []}
        keyExtractor={(item) => item.leagueId}
        contentContainerStyle={s.list}
        onRefresh={() => leagues.refetch()}
        refreshing={leagues.isFetching}
        ListEmptyComponent={
          <Text style={s.empty}>Aucune ligue. Creez-en une ou rejoignez par code !</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={s.card}
            onPress={() => router.push({ pathname: "/standings/[id]", params: { id: item.leagueId } })}
          >
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.cardMeta}>
                  {item.memberCount} membre{item.memberCount > 1 ? "s" : ""}
                </Text>
              </View>
              {item.currentRank && (
                <View style={s.rankBadge}>
                  <Text style={s.rankText}>#{item.currentRank}</Text>
                </View>
              )}
            </View>
            {item.type === "private" && (
              <Pressable style={s.shareBtn} onPress={() => handleShare(item.code, item.name)}>
                <Text style={s.shareText}>Partager</Text>
              </Pressable>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", gap: SPACING.md },
  title: { fontSize: FONT.xxl, fontWeight: "800", color: COLORS.textPrimary, marginBottom: SPACING.md },
  actions: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.xl,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "600", fontSize: FONT.sm },
  btnOutline: {
    borderWidth: 1, borderColor: COLORS.accent,
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.xl,
  },
  btnOutlineText: { color: COLORS.accentLight, fontWeight: "600", fontSize: FONT.sm },
  form: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md, alignItems: "center" },
  input: {
    flex: 1, backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FONT.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  formBtn: { backgroundColor: COLORS.accent, paddingVertical: 10, paddingHorizontal: 16, borderRadius: RADIUS.md },
  list: { gap: SPACING.sm, paddingBottom: SPACING.xxl },
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: FONT.lg, fontWeight: "600", color: COLORS.textPrimary },
  cardMeta: { fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 2 },
  rankBadge: {
    backgroundColor: COLORS.accent, width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  rankText: { color: "#fff", fontSize: FONT.md, fontWeight: "700" },
  shareBtn: { marginTop: SPACING.sm },
  shareText: { color: COLORS.accentLight, fontSize: FONT.sm, fontWeight: "500" },
  empty: { color: COLORS.textMuted, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.xxl },
  errorText: { fontSize: FONT.md, color: COLORS.textSecondary },
  retryBtn: { backgroundColor: COLORS.accent, paddingVertical: 10, paddingHorizontal: 24, borderRadius: RADIUS.md },
  retryBtnText: { color: "#fff", fontWeight: "600" },
});
