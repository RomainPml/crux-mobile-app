import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useMyLeagues, useCreateLeague, useJoinLeague } from "../../lib/hooks";
import { api } from "../../lib/api";

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
        onSuccess: (data) => {
          setShowJoin(false);
          setCode("");
          Alert.alert("Rejoint !", data.name);
        },
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={() => setShowCreate(!showCreate)}>
          <Text style={styles.btnText}>+ Creer</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => setShowJoin(!showJoin)}>
          <Text style={styles.btnTextSecondary}>Rejoindre</Text>
        </Pressable>
      </View>

      {showCreate && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nom de la ligue"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Pressable style={styles.btnSmall} onPress={handleCreate}>
            <Text style={styles.btnText}>Creer</Text>
          </Pressable>
        </View>
      )}

      {showJoin && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Code (6 caracteres)"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            autoCapitalize="characters"
          />
          <Pressable style={styles.btnSmall} onPress={handleJoin}>
            <Text style={styles.btnText}>Rejoindre</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={leagues.data?.leagues ?? []}
        keyExtractor={(item) => item.leagueId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({ pathname: "/standings/[id]", params: { id: item.leagueId } })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.type === "private" && (
                <Pressable onPress={() => handleShare(item.code, item.name)}>
                  <Text style={styles.shareBtn}>Partager</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.cardMeta}>
              {item.memberCount} membre{item.memberCount > 1 ? "s" : ""}
              {item.currentRank ? ` — Rang #${item.currentRank}` : ""}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  actions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  btn: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#007AFF" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnTextSecondary: { color: "#007AFF", fontWeight: "600" },
  btnSmall: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  form: { flexDirection: "row", gap: 8, marginBottom: 16, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  list: { gap: 8 },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  cardMeta: { fontSize: 13, color: "#888", marginTop: 4 },
  shareBtn: { color: "#007AFF", fontSize: 14, fontWeight: "500" },
});
