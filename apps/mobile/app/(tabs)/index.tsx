import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import { usePuzzleToday, useSubmitResult } from "../../lib/hooks";

export default function PuzzleScreen() {
  const puzzle = usePuzzleToday();
  const submit = useSubmitResult();
  const [submitted, setSubmitted] = useState(false);

  if (puzzle.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (puzzle.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Erreur de chargement</Text>
        <Pressable style={styles.btn} onPress={() => puzzle.refetch()}>
          <Text style={styles.btnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  const data = puzzle.data!;

  const handleSubmit = () => {
    submit.mutate(
      {
        puzzleId: data.puzzleId,
        servedAt: data.servedAt,
        cleanDeductions: 3, // stub: fixed value
      },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Puzzle du jour</Text>
      <Text style={styles.meta}>
        {data.day} — Difficulte {data.difficulty}/5
      </Text>

      <View style={styles.puzzleArea}>
        <Text style={styles.stub}>[ Puzzle stub ]</Text>
        <Text style={styles.hint}>Le vrai puzzle sera branche ici</Text>
      </View>

      {submitted && submit.data ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>Resultat</Text>
          <Text style={styles.resultText}>Score : {submit.data.score}</Text>
          <Text style={styles.resultText}>
            Temps : {(submit.data.timeMs / 1000).toFixed(1)}s
          </Text>
          {submit.data.suspect && (
            <Text style={styles.suspect}>Suspect (trop rapide)</Text>
          )}
        </View>
      ) : (
        <Pressable
          style={[styles.btn, submit.isPending && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submit.isPending}
        >
          <Text style={styles.btnText}>
            {submit.isPending ? "Envoi..." : "Soumettre"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  meta: { fontSize: 14, color: "#888", marginBottom: 24 },
  puzzleArea: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  stub: { fontSize: 20, fontWeight: "600", color: "#bbb" },
  hint: { fontSize: 12, color: "#ccc", marginTop: 8 },
  btn: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  result: { alignItems: "center", gap: 4 },
  resultTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  resultText: { fontSize: 16 },
  suspect: { color: "red", marginTop: 8 },
  error: { fontSize: 16, color: "red", marginBottom: 12 },
});
