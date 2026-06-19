import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useJoinLeague } from "../../lib/hooks";
import { useEffect, useState } from "react";

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const joinLeague = useJoinLeague();
  const router = useRouter();
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (!code) return;
    joinLeague.mutate(
      { code: code.toUpperCase() },
      {
        onSuccess: () => setJoined(true),
      },
    );
  };

  // Auto-join on mount
  useEffect(() => {
    handleJoin();
  }, [code]);

  if (joinLeague.isPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Rejoindre la ligue...</Text>
      </View>
    );
  }

  if (joinLeague.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Code invalide ou ligue introuvable</Text>
        <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/leagues")}>
          <Text style={styles.btnText}>Retour aux ligues</Text>
        </Pressable>
      </View>
    );
  }

  if (joined && joinLeague.data) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rejoint !</Text>
        <Text style={styles.text}>{joinLeague.data.name}</Text>
        <Pressable
          style={styles.btn}
          onPress={() =>
            router.replace({
              pathname: "/standings/[id]",
              params: { id: joinLeague.data!.leagueId },
            })
          }
        >
          <Text style={styles.btnText}>Voir le classement</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  text: { fontSize: 16, color: "#666", marginTop: 12 },
  error: { fontSize: 16, color: "red", marginBottom: 16, textAlign: "center" },
  btn: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 16,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
