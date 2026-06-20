import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert, FlatList, Dimensions } from "react-native";
import { useState, useRef, useCallback } from "react";
import { useMonthStatus, usePuzzleToday, usePuzzleByDate, useSubmitGuess } from "../../lib/hooks";
import type { LetterResult, GuessResponse, PuzzleTodayResponse } from "@crux/shared";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const COLORS: Record<LetterResult, string> = {
  correct: "#538d4e",
  present: "#b59f3b",
  absent: "#3a3a3c",
};

// ── Day indicator strip ──
function DayStrip({ days, currentIndex, onDayPress }: {
  days: { date: string; status: string }[];
  currentIndex: number;
  onDayPress: (index: number) => void;
}) {
  return (
    <View style={stripStyles.container}>
      {days.map((d, i) => (
        <Pressable key={d.date} onPress={() => onDayPress(i)} style={stripStyles.dot}>
          <View style={[
            stripStyles.circle,
            d.status === "completed" && stripStyles.completed,
            d.status === "today" && stripStyles.today,
            i === currentIndex && stripStyles.active,
          ]} />
          {i === currentIndex && (
            <Text style={stripStyles.label}>
              {d.date.slice(8)}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const stripStyles = StyleSheet.create({
  container: { flexDirection: "row", justifyContent: "center", paddingVertical: 8, gap: 4, flexWrap: "wrap" },
  dot: { alignItems: "center", width: 20 },
  circle: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3a3a3c" },
  completed: { backgroundColor: "#538d4e" },
  today: { backgroundColor: "#b59f3b" },
  active: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "#fff" },
  label: { color: "#888", fontSize: 9, marginTop: 2 },
});

// ── Single puzzle game ──
function PuzzleGame({ date, isCatchUp }: { date: string; isCatchUp: boolean }) {
  const isToday = !isCatchUp;
  const todayQuery = usePuzzleToday();
  const catchUpQuery = usePuzzleByDate(date);

  const puzzle = isToday ? todayQuery : catchUpQuery;
  const submitGuess = useSubmitGuess();
  const [guesses, setGuesses] = useState<{ word: string; result: LetterResult[] }[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [finalResult, setFinalResult] = useState<GuessResponse | null>(null);
  const inputRef = useRef<TextInput>(null);

  const data = puzzle.data as PuzzleTodayResponse | undefined;
  const wordLength = data?.config?.wordLength ?? 5;
  const maxAttempts = data?.config?.maxAttempts ?? 6;

  const handleSubmit = useCallback(() => {
    const guess = currentInput.toUpperCase().trim();
    if (guess.length !== wordLength || !data || gameOver || submitGuess.isPending) return;

    submitGuess.mutate(
      { puzzleId: data.puzzleId, guess },
      {
        onSuccess: (res) => {
          setGuesses((prev) => [...prev, { word: guess, result: res.result }]);
          setCurrentInput("");
          if (res.solved || res.attemptsUsed >= res.maxAttempts) {
            setGameOver(true);
            setFinalResult(res);
          }
        },
        onError: (e) => {
          Alert.alert("", e.message.includes("400") ? "Mot non reconnu" : "Erreur reseau");
        },
      },
    );
  }, [currentInput, wordLength, data, gameOver, submitGuess]);

  if (puzzle.isLoading) {
    return <View style={gs.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (puzzle.error || !data) {
    const msg = (puzzle.error as any)?.message ?? "";
    if (msg.includes("deja complete")) {
      return <View style={gs.center}><Text style={gs.doneText}>Deja joue !</Text></View>;
    }
    return (
      <View style={gs.center}>
        <Text style={gs.errorText}>Erreur</Text>
        <Text style={gs.errorDetail}>{msg}</Text>
      </View>
    );
  }

  return (
    <Pressable style={gs.page} onPress={() => inputRef.current?.focus()}>
      {/* Catch-up banner */}
      {isCatchUp && !gameOver && (
        <View style={gs.catchUpBanner}>
          <Text style={gs.catchUpText}>Rattrapage du {date.slice(5)} (50% des points)</Text>
        </View>
      )}

      {/* Result banner */}
      {gameOver && finalResult && (
        <View style={[gs.banner, finalResult.solved ? gs.bannerWin : gs.bannerLose]}>
          <Text style={gs.bannerText}>
            {finalResult.solved ? `Bravo ! ${finalResult.score} pts` : "Perdu..."}
          </Text>
          {finalResult.timeMs != null && (
            <Text style={gs.bannerSub}>
              {Math.round(finalResult.timeMs / 1000)}s — {finalResult.attemptsUsed}/{finalResult.maxAttempts} essais
              {isCatchUp ? " (rattrapage)" : ""}
            </Text>
          )}
        </View>
      )}

      {/* Grid */}
      <View style={gs.grid}>
        {Array.from({ length: maxAttempts }).map((_, row) => {
          const guess = guesses[row];
          const isCurrentRow = row === guesses.length && !gameOver;
          const letters = guess?.word ?? (isCurrentRow ? currentInput.toUpperCase() : "");
          return (
            <View key={row} style={gs.gridRow}>
              {Array.from({ length: wordLength }).map((_, col) => {
                const letter = letters[col] ?? "";
                const result = guess?.result[col];
                const bg = result ? COLORS[result] : letter ? "#878a8c" : "transparent";
                const borderColor = result ? bg : letter ? "#565758" : "#3a3a3c";
                return (
                  <View key={col} style={[gs.cell, { backgroundColor: bg, borderColor }]}>
                    <Text style={[gs.cellText, { color: result || letter ? "#fff" : "#555" }]}>{letter}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      {/* Input */}
      {!gameOver && (
        <View style={gs.inputArea}>
          <TextInput
            ref={inputRef}
            style={gs.textInput}
            value={currentInput}
            onChangeText={(t) => setCurrentInput(t.replace(/[^a-zA-Z]/g, "").slice(0, wordLength))}
            onSubmitEditing={handleSubmit}
            maxLength={wordLength}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!isCatchUp}
            placeholder={`${wordLength} lettres...`}
            placeholderTextColor="#555"
            returnKeyType="send"
            editable={!submitGuess.isPending}
          />
          <Pressable
            style={[gs.sendBtn, currentInput.length < wordLength && gs.sendBtnDisabled]}
            onPress={handleSubmit}
            disabled={currentInput.length < wordLength || submitGuess.isPending}
          >
            <Text style={gs.sendBtnText}>{submitGuess.isPending ? "..." : "OK"}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ── Main screen with swipe ──
export default function PuzzleScreen() {
  const monthStatus = useMonthStatus();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Build list of playable days: missed + today
  const daysList: { date: string; status: string }[] = [];
  if (monthStatus.data) {
    const entries = Object.entries(monthStatus.data.days).sort(([a], [b]) => a.localeCompare(b));
    for (const [date, status] of entries) {
      if (status === "missed" || status === "today") {
        daysList.push({ date, status });
      }
    }
  }

  // Default to last item (today)
  const initialIndex = daysList.length - 1;
  if (currentIndex === -1 && daysList.length > 0) {
    setCurrentIndex(initialIndex);
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  if (monthStatus.isLoading || daysList.length === 0) {
    return <View style={gs.center}><ActivityIndicator color="#fff" /></View>;
  }

  return (
    <View style={gs.container}>
      <DayStrip
        days={daysList}
        currentIndex={currentIndex >= 0 ? currentIndex : initialIndex}
        onDayPress={(i) => flatListRef.current?.scrollToIndex({ index: i, animated: true })}
      />
      <FlatList
        ref={flatListRef}
        horizontal
        pagingEnabled
        data={daysList}
        keyExtractor={(item) => item.date}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            <PuzzleGame date={item.date} isCatchUp={item.status === "missed"} />
          </View>
        )}
      />
    </View>
  );
}

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121213" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121213" },
  page: { flex: 1 },
  errorText: { fontSize: 16, color: "#888" },
  errorDetail: { fontSize: 12, color: "#555", textAlign: "center", paddingHorizontal: 24, marginTop: 4 },
  doneText: { fontSize: 18, color: "#538d4e", fontWeight: "600" },
  catchUpBanner: { backgroundColor: "#b59f3b", padding: 8, alignItems: "center" },
  catchUpText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  banner: { padding: 16, alignItems: "center" },
  bannerWin: { backgroundColor: "#538d4e" },
  bannerLose: { backgroundColor: "#3a3a3c" },
  bannerText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  bannerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  grid: { alignItems: "center", paddingVertical: 16, gap: 6, flex: 1, justifyContent: "center" },
  gridRow: { flexDirection: "row", gap: 6 },
  cell: { width: 58, height: 58, borderWidth: 2, justifyContent: "center", alignItems: "center", borderRadius: 4 },
  cellText: { fontSize: 28, fontWeight: "700" },
  inputArea: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 16, gap: 8, alignItems: "center" },
  textInput: {
    flex: 1, backgroundColor: "#2a2a2b", color: "#fff", fontSize: 22, fontWeight: "600",
    letterSpacing: 8, textAlign: "center", paddingVertical: 14, borderRadius: 8, textTransform: "uppercase",
  },
  sendBtn: { backgroundColor: "#538d4e", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8 },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
