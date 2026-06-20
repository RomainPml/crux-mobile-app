import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert } from "react-native";
import { useState, useRef } from "react";
import { usePuzzleToday, useSubmitGuess } from "../../lib/hooks";
import type { LetterResult, GuessResponse } from "@crux/shared";

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
  const inputRef = useRef<TextInput>(null);

  const wordLength = puzzle.data?.config?.wordLength ?? 5;
  const maxAttempts = puzzle.data?.config?.maxAttempts ?? 6;

  const handleSubmit = () => {
    const guess = currentInput.toUpperCase().trim();
    if (guess.length !== wordLength || !puzzle.data || gameOver || submitGuess.isPending) return;

    submitGuess.mutate(
      { puzzleId: puzzle.data.puzzleId, guess },
      {
        onSuccess: (data) => {
          setGuesses((prev) => [...prev, { word: guess, result: data.result }]);
          setCurrentInput("");
          if (data.solved || data.attemptsUsed >= data.maxAttempts) {
            setGameOver(true);
            setFinalResult(data);
          }
        },
        onError: (e) => {
          const msg = e.message.includes("400") ? "Mot non reconnu" : "Erreur reseau";
          Alert.alert("", msg);
        },
      },
    );
  };

  if (puzzle.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
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
    <Pressable style={styles.container} onPress={() => inputRef.current?.focus()}>
      {/* Result banner */}
      {gameOver && finalResult && (
        <View style={[styles.banner, finalResult.solved ? styles.bannerWin : styles.bannerLose]}>
          <Text style={styles.bannerText}>
            {finalResult.solved ? `Bravo ! ${finalResult.score} pts` : "Perdu..."}
          </Text>
          {finalResult.timeMs != null && (
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
          const letters = guess?.word ?? (isCurrentRow ? currentInput.toUpperCase() : "");

          return (
            <View key={row} style={styles.gridRow}>
              {Array.from({ length: wordLength }).map((_, col) => {
                const letter = letters[col] ?? "";
                const result = guess?.result[col];
                const bg = result ? COLORS[result] : letter ? "#878a8c" : "transparent";
                const borderColor = result ? bg : letter ? "#565758" : "#3a3a3c";

                return (
                  <View key={col} style={[styles.cell, { backgroundColor: bg, borderColor }]}>
                    <Text style={[styles.cellText, { color: result || letter ? "#fff" : "#555" }]}>
                      {letter}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      {/* Native text input (hidden but captures keyboard) */}
      {!gameOver && (
        <View style={styles.inputArea}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={currentInput}
            onChangeText={(t) => setCurrentInput(t.replace(/[^a-zA-Z]/g, "").slice(0, wordLength))}
            onSubmitEditing={handleSubmit}
            maxLength={wordLength}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            placeholder={`${wordLength} lettres...`}
            placeholderTextColor="#555"
            returnKeyType="send"
            editable={!submitGuess.isPending}
          />
          <Pressable
            style={[styles.sendBtn, currentInput.length < wordLength && styles.sendBtnDisabled]}
            onPress={handleSubmit}
            disabled={currentInput.length < wordLength || submitGuess.isPending}
          >
            <Text style={styles.sendBtnText}>
              {submitGuess.isPending ? "..." : "OK"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Loading */}
      {submitGuess.isPending && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121213" },
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
  grid: { alignItems: "center", paddingVertical: 24, gap: 6, flex: 1, justifyContent: "center" },
  gridRow: { flexDirection: "row", gap: 6 },
  cell: {
    width: 58,
    height: 58,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  cellText: { fontSize: 28, fontWeight: "700" },
  inputArea: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#2a2a2b",
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 8,
    textAlign: "center",
    paddingVertical: 14,
    borderRadius: 8,
    textTransform: "uppercase",
  },
  sendBtn: {
    backgroundColor: "#538d4e",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
});
