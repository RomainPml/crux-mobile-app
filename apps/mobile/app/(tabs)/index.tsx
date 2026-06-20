import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState, useCallback } from "react";
import { usePuzzleToday, useSubmitGuess } from "../../lib/hooks";
import type { LetterResult, GuessResponse } from "@crux/shared";

const KEYBOARD_ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["ENT", "W", "X", "C", "V", "B", "N", "DEL"],
];

const COLORS: Record<LetterResult, string> = {
  correct: "#538d4e",
  present: "#b59f3b",
  absent: "#3a3a3c",
};

interface GuessRow {
  word: string;
  result: LetterResult[];
}

export default function PuzzleScreen() {
  const puzzle = usePuzzleToday();
  const submitGuess = useSubmitGuess();
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [finalResult, setFinalResult] = useState<GuessResponse | null>(null);
  const [letterStates, setLetterStates] = useState<Record<string, LetterResult>>({});

  const wordLength = puzzle.data?.config?.wordLength ?? 5;
  const maxAttempts = puzzle.data?.config?.maxAttempts ?? 6;

  const handleKey = useCallback((key: string) => {
    if (gameOver || submitGuess.isPending) return;

    if (key === "DEL") {
      setCurrentInput((p) => p.slice(0, -1));
    } else if (key === "ENT") {
      if (currentInput.length !== wordLength) return;
      if (!puzzle.data) return;

      submitGuess.mutate(
        { puzzleId: puzzle.data.puzzleId, guess: currentInput },
        {
          onSuccess: (data) => {
            const newRow: GuessRow = { word: currentInput, result: data.result };
            setGuesses((prev) => [...prev, newRow]);
            setCurrentInput("");

            // Update keyboard letter states
            setLetterStates((prev) => {
              const next = { ...prev };
              for (let i = 0; i < currentInput.length; i++) {
                const letter = currentInput[i];
                const r = data.result[i];
                if (r === "correct") next[letter] = "correct";
                else if (r === "present" && next[letter] !== "correct") next[letter] = "present";
                else if (r === "absent" && !next[letter]) next[letter] = "absent";
              }
              return next;
            });

            if (data.solved || data.attemptsUsed >= data.maxAttempts) {
              setGameOver(true);
              setFinalResult(data);
            }
          },
          onError: (e) => {
            const msg = e.message.includes("400") ? "Mot invalide" : "Erreur reseau";
            Alert.alert("Erreur", msg);
          },
        },
      );
    } else if (currentInput.length < wordLength) {
      setCurrentInput((p) => p + key);
    }
  }, [currentInput, wordLength, gameOver, submitGuess, puzzle.data]);

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
        <Text style={styles.errorDetail}>{puzzle.error?.message ?? ""}</Text>
        <Pressable style={styles.retryBtn} onPress={() => puzzle.refetch()}>
          <Text style={styles.retryBtnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Result banner */}
      {gameOver && finalResult && (
        <View style={[styles.banner, finalResult.solved ? styles.bannerWin : styles.bannerLose]}>
          <Text style={styles.bannerText}>
            {finalResult.solved ? `Bravo ! ${finalResult.score} pts` : "Perdu..."}
          </Text>
          {finalResult.timeMs && (
            <Text style={styles.bannerSub}>
              {Math.round(finalResult.timeMs / 1000)}s — {finalResult.attemptsUsed}/{finalResult.maxAttempts} essais
            </Text>
          )}
        </View>
      )}

      {/* Grid */}
      <View style={styles.grid}>
        {Array.from({ length: maxAttempts }).map((_, row) => {
          const guess = guesses[row];
          const isCurrentRow = row === guesses.length && !gameOver;
          const letters = guess?.word ?? (isCurrentRow ? currentInput : "");

          return (
            <View key={row} style={styles.gridRow}>
              {Array.from({ length: wordLength }).map((_, col) => {
                const letter = letters[col] ?? "";
                const result = guess?.result[col];
                const bg = result ? COLORS[result] : letter ? "#878a8c" : "transparent";
                const borderColor = result ? bg : letter ? "#565758" : "#3a3a3c";

                return (
                  <View key={col} style={[styles.cell, { backgroundColor: bg, borderColor }]}>
                    <Text style={[styles.cellText, { color: result || letter ? "#fff" : "#888" }]}>
                      {letter}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      {/* Keyboard */}
      <View style={styles.keyboard}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <View key={ri} style={styles.kbRow}>
            {row.map((key) => {
              const state = letterStates[key];
              const isSpecial = key === "ENT" || key === "DEL";
              const bg = state ? COLORS[state] : "#818384";

              return (
                <Pressable
                  key={key}
                  style={[styles.kbKey, { backgroundColor: bg }, isSpecial && styles.kbKeyWide]}
                  onPress={() => handleKey(key)}
                >
                  <Text style={styles.kbKeyText}>
                    {key === "DEL" ? "\u232B" : key === "ENT" ? "\u21B5" : key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {submitGuess.isPending && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121213", justifyContent: "space-between" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121213", gap: 12 },
  errorText: { fontSize: 16, color: "#888" },
  errorDetail: { fontSize: 12, color: "#555", textAlign: "center", paddingHorizontal: 24 },
  retryBtn: { backgroundColor: "#538d4e", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontWeight: "600" },
  banner: { padding: 16, alignItems: "center" },
  bannerWin: { backgroundColor: "#538d4e" },
  bannerLose: { backgroundColor: "#3a3a3c" },
  bannerText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  bannerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  grid: { alignItems: "center", paddingVertical: 16, gap: 6 },
  gridRow: { flexDirection: "row", gap: 6 },
  cell: {
    width: 56,
    height: 56,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
  },
  cellText: { fontSize: 28, fontWeight: "700" },
  keyboard: { paddingBottom: 16, paddingHorizontal: 4, gap: 6 },
  kbRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  kbKey: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    minWidth: 30,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  kbKeyWide: { paddingHorizontal: 14 },
  kbKeyText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
});
