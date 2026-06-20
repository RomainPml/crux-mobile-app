import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useState } from "react";
import { usePuzzleToday, useSubmitResult } from "../../lib/hooks";
import PuzzleBoard from "../../components/puzzle/PuzzleBoard";

export default function PuzzleScreen() {
  const puzzle = usePuzzleToday();
  const submit = useSubmitResult();
  const [submitted, setSubmitted] = useState(false);

  if (puzzle.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  if (puzzle.error || !puzzle.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Erreur de chargement</Text>
        <Text style={styles.errorDetail}>{puzzle.error?.message ?? "Reponse vide"}</Text>
        <Pressable style={styles.retryBtn} onPress={() => puzzle.refetch()}>
          <Text style={styles.retryBtnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  const data = puzzle.data;

  if (!data.grid) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Puzzle non disponible</Text>
      </View>
    );
  }

  const handleSubmit = (solution: Record<string, string>[], cleanDeductions: number) => {
    submit.mutate(
      { puzzleId: data.puzzleId, cleanDeductions, solution },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  return (
    <View style={styles.container}>
      {/* Result overlay */}
      {submitted && submit.data ? (
        <View style={styles.resultOverlay}>
          <Text style={styles.resultEmoji}>
            {submit.data.correct ? "\u2705" : "\u274c"}
          </Text>
          <Text style={styles.resultTitle}>
            {submit.data.correct ? "Correct !" : "Incorrect"}
          </Text>
          <Text style={styles.resultScore}>
            {submit.data.score} pts
          </Text>
          <Text style={styles.resultTime}>
            {(submit.data.timeMs / 1000).toFixed(0)}s
          </Text>
          {submit.data.suspect && (
            <Text style={styles.resultSuspect}>Resultat suspect</Text>
          )}
        </View>
      ) : null}

      {/* Puzzle board */}
      <PuzzleBoard
        grid={data.grid}
        onSubmit={handleSubmit}
        submitted={submitted}
      />

      {/* Loading overlay during submission */}
      {submit.isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { fontSize: 16, color: "#888" },
  errorDetail: { fontSize: 12, color: "#bbb", marginTop: 4, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryBtnText: { color: "#fff", fontWeight: "600" },
  resultOverlay: {
    backgroundColor: "#f9f9f9",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  resultEmoji: { fontSize: 32, marginBottom: 4 },
  resultTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a" },
  resultScore: { fontSize: 28, fontWeight: "300", color: "#1a1a1a", marginTop: 2 },
  resultTime: { fontSize: 14, color: "#888", marginTop: 2 },
  resultSuspect: { fontSize: 12, color: "#e74c3c", marginTop: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
});
