import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput,
  Alert, FlatList, Dimensions, Animated, ScrollView,
} from "react-native";
import { useState, useRef, useCallback, useEffect } from "react";
import { useMonthStatus, usePuzzleToday, usePuzzleByDate, useSubmitGuess } from "../../lib/hooks";
import type { LetterResult, GuessResponse, PuzzleTodayResponse } from "@crux/shared";
import AnimatedCell from "../../components/AnimatedCell";
import { COLORS, SPACING, FONT, RADIUS } from "../../lib/theme";

const { width: SW } = Dimensions.get("window");

// ── Day strip ──
function DayStrip({ days, currentIndex, onDayPress }: {
  days: { date: string; status: string }[];
  currentIndex: number;
  onDayPress: (i: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (currentIndex >= 0) {
      scrollRef.current?.scrollTo({ x: Math.max(0, currentIndex * 48 - SW / 2 + 24), animated: true });
    }
  }, [currentIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ds.strip}
    >
      {days.map((d, i) => {
        const isActive = i === currentIndex;
        const bg = d.status === "completed" ? COLORS.correct
          : d.status === "today" ? COLORS.present
          : COLORS.absent;
        return (
          <Pressable key={d.date} onPress={() => onDayPress(i)}
            style={[ds.day, { backgroundColor: bg }, isActive && ds.dayActive]}
          >
            <Text style={[ds.dayNum, isActive && ds.dayNumActive]}>{d.date.slice(8)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ds = StyleSheet.create({
  strip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 6 },
  day: {
    width: 42, height: 42, borderRadius: RADIUS.sm,
    justifyContent: "center", alignItems: "center",
  },
  dayActive: { borderWidth: 2, borderColor: "#fff" },
  dayNum: { fontSize: FONT.md, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  dayNumActive: { color: "#fff", fontWeight: "700" },
});

// ── Puzzle game ──
function PuzzleGame({ date, isCatchUp }: { date: string; isCatchUp: boolean }) {
  const todayQuery = usePuzzleToday();
  const catchUpQuery = usePuzzleByDate(date);
  const puzzle = isCatchUp ? catchUpQuery : todayQuery;
  const submitGuess = useSubmitGuess();

  const [guesses, setGuesses] = useState<{ word: string; result: LetterResult[] }[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [finalResult, setFinalResult] = useState<GuessResponse | null>(null);
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());
  const [winRow, setWinRow] = useState(-1);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const data = puzzle.data as PuzzleTodayResponse | undefined;
  const wl = data?.config?.wordLength ?? 5;
  const maxAttempts = data?.config?.maxAttempts ?? 6;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = useCallback(() => {
    const guess = currentInput.toUpperCase().trim();
    if (guess.length !== wl || !data || gameOver || submitGuess.isPending) return;

    submitGuess.mutate(
      { puzzleId: data.puzzleId, guess },
      {
        onSuccess: (res) => {
          const newIdx = guesses.length;
          setGuesses((prev) => [...prev, { word: guess, result: res.result }]);
          setCurrentInput("");
          // Trigger reveal animation after a tick
          setTimeout(() => setRevealedRows((prev) => new Set(prev).add(newIdx)), 50);

          if (res.solved) {
            // Win bounce after flip completes
            setTimeout(() => setWinRow(newIdx), wl * 250 + 400);
            setTimeout(() => {
              setGameOver(true);
              setFinalResult(res);
              Animated.timing(bannerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
            }, wl * 250 + 800);
          } else if (res.attemptsUsed >= res.maxAttempts) {
            setTimeout(() => {
              setGameOver(true);
              setFinalResult(res);
              Animated.timing(bannerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
            }, wl * 250 + 400);
          }
        },
        onError: () => shake(),
      },
    );
  }, [currentInput, wl, data, gameOver, submitGuess, guesses.length]);

  if (puzzle.isLoading) return <View style={gs.center}><ActivityIndicator color={COLORS.accent} /></View>;

  if (puzzle.error || !data) {
    const msg = (puzzle.error as any)?.message ?? "";
    if (msg.includes("deja complete")) {
      return <View style={gs.center}><Text style={gs.doneText}>Deja joue !</Text></View>;
    }
    return <View style={gs.center}><Text style={gs.errorText}>{msg || "Erreur"}</Text></View>;
  }

  return (
    <Pressable style={gs.page} onPress={() => inputRef.current?.focus()}>
      {isCatchUp && !gameOver && (
        <View style={gs.catchUpBanner}>
          <Text style={gs.catchUpText}>Rattrapage du {date.slice(5)} — 50% des points</Text>
        </View>
      )}

      {/* Result */}
      {gameOver && finalResult && (
        <Animated.View style={[
          gs.banner, finalResult.solved ? gs.bannerWin : gs.bannerLose,
          { opacity: bannerAnim, transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
        ]}>
          <Text style={gs.bannerText}>
            {finalResult.solved ? `Bravo ! ${finalResult.score} pts` : "Perdu..."}
          </Text>
          {finalResult.timeMs != null && (
            <Text style={gs.bannerSub}>
              {Math.round(finalResult.timeMs / 1000)}s — {finalResult.attemptsUsed}/{maxAttempts} essais
            </Text>
          )}
        </Animated.View>
      )}

      {/* Grid */}
      <View style={gs.grid}>
        {Array.from({ length: maxAttempts }).map((_, row) => {
          const guess = guesses[row];
          const isCurrentRow = row === guesses.length && !gameOver;
          const letters = guess?.word ?? (isCurrentRow ? currentInput.toUpperCase() : "");
          const isRevealed = revealedRows.has(row);
          const isWin = row === winRow;

          return (
            <Animated.View
              key={row}
              style={[gs.gridRow, isCurrentRow && { transform: [{ translateX: shakeAnim }] }]}
            >
              {Array.from({ length: wl }).map((_, col) => (
                <AnimatedCell
                  key={col}
                  letter={letters[col] ?? ""}
                  result={guess?.result[col]}
                  revealed={isRevealed}
                  delay={col * 200}
                  bounce={isWin}
                  bounceDelay={col * 100}
                />
              ))}
            </Animated.View>
          );
        })}
      </View>

      {/* Hidden input */}
      {!gameOver && (
        <TextInput
          ref={inputRef}
          style={gs.hiddenInput}
          value={currentInput}
          onChangeText={(t) => setCurrentInput(t.replace(/[^a-zA-Z]/g, "").slice(0, wl))}
          onSubmitEditing={handleSubmit}
          maxLength={wl}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={!isCatchUp}
          returnKeyType="send"
          editable={!submitGuess.isPending}
        />
      )}

      {!gameOver && currentInput.length === wl && (
        <Pressable style={gs.fab} onPress={handleSubmit}>
          <Text style={gs.fabText}>{submitGuess.isPending ? "..." : "\u2713"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// ── Main ──
export default function PuzzleScreen() {
  const monthStatus = useMonthStatus();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const daysList: { date: string; status: string }[] = [];
  if (monthStatus.data) {
    const entries = Object.entries(monthStatus.data.days).sort(([a], [b]) => a.localeCompare(b));
    for (const [date, status] of entries) {
      if (status === "missed" || status === "today") daysList.push({ date, status });
    }
  }

  const initialIndex = daysList.length - 1;
  if (currentIndex === -1 && daysList.length > 0) setCurrentIndex(initialIndex);

  const onViewable = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }, []);

  if (monthStatus.isLoading || daysList.length === 0) {
    return <View style={gs.center}><ActivityIndicator color={COLORS.accent} /></View>;
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
        getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width: SW }}>
            <PuzzleGame date={item.date} isCatchUp={item.status === "missed"} />
          </View>
        )}
      />
    </View>
  );
}

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" },
  page: { flex: 1 },
  errorText: { fontSize: FONT.md, color: COLORS.textSecondary, textAlign: "center", padding: SPACING.lg },
  doneText: { fontSize: FONT.lg, color: COLORS.correct, fontWeight: "600" },
  catchUpBanner: { backgroundColor: COLORS.present, padding: SPACING.sm, alignItems: "center" },
  catchUpText: { color: "#fff", fontSize: FONT.sm, fontWeight: "600" },
  banner: { padding: SPACING.lg, alignItems: "center" },
  bannerWin: { backgroundColor: COLORS.correct },
  bannerLose: { backgroundColor: COLORS.absent },
  bannerText: { color: "#fff", fontSize: FONT.xl, fontWeight: "700" },
  bannerSub: { color: "rgba(255,255,255,0.7)", fontSize: FONT.sm, marginTop: SPACING.xs },
  grid: { alignItems: "center", paddingVertical: SPACING.md, gap: 6, flex: 1, justifyContent: "center" },
  gridRow: { flexDirection: "row", gap: 6 },
  hiddenInput: { position: "absolute", opacity: 0, height: 0 },
  fab: {
    position: "absolute", bottom: SPACING.xl, right: SPACING.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent,
    justifyContent: "center", alignItems: "center",
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: "#fff", fontSize: 24, fontWeight: "700" },
});
