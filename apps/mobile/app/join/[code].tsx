import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useJoinLeague } from "../../lib/hooks";
import { useEffect, useState } from "react";
import { COLORS, SPACING, FONT, RADIUS } from "../../lib/theme";

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const joinLeague = useJoinLeague();
  const router = useRouter();
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!code) return;
    joinLeague.mutate(
      { code: code.toUpperCase() },
      { onSuccess: () => setJoined(true) },
    );
  }, [code]);

  if (joinLeague.isPending) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.text}>Rejoindre la ligue...</Text>
      </View>
    );
  }

  if (joinLeague.error) {
    return (
      <View style={s.container}>
        <Text style={s.errorText}>Code invalide ou ligue introuvable</Text>
        <Pressable style={s.btn} onPress={() => router.replace("/(tabs)/leagues")}>
          <Text style={s.btnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (joined && joinLeague.data) {
    return (
      <View style={s.container}>
        <Text style={s.successEmoji}>{"\u2705"}</Text>
        <Text style={s.title}>{joinLeague.data.name}</Text>
        <Text style={s.text}>Rejoint !</Text>
        <Pressable
          style={s.btn}
          onPress={() => router.replace({ pathname: "/standings/[id]", params: { id: joinLeague.data!.leagueId } })}
        >
          <Text style={s.btnText}>Voir le classement</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: SPACING.lg, gap: SPACING.md },
  title: { fontSize: FONT.xl, fontWeight: "700", color: COLORS.textPrimary },
  text: { fontSize: FONT.md, color: COLORS.textSecondary },
  successEmoji: { fontSize: 48 },
  errorText: { fontSize: FONT.md, color: COLORS.lose, textAlign: "center" },
  btn: { backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: RADIUS.lg, marginTop: SPACING.md },
  btnText: { color: "#fff", fontSize: FONT.md, fontWeight: "600" },
});
