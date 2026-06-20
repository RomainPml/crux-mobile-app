import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput,
  Alert, FlatList, Dimensions, Animated, ScrollView,
} from "react-native";
import { useState, useRef, useCallback, useEffect } from "react";
import { useMonthStatus, usePuzzleToday, usePuzzleByDate, useSubmitGuess } from "../../lib/hooks";
import type { LetterResult, GuessResponse, PuzzleTodayResponse } from "@crux/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AnimatedCell from "../../components/AnimatedCell";
import { COLORS, SPACING, FONT, RADIUS } from "../../lib/theme";

const SESSION_KEY = (date: string) => `crux_session_${date}`;

interface SessionData {
  guesses: { word: string; result: LetterResult[] }[];
  gameOver: boolean;
  finalResult: GuessResponse | null;
}

const { width: SW, height: SH } = Dimensions.get("window");

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
          : d.status === "today" ? COLORS.accent
          : d.status === "missed" ? COLORS.present
          : COLORS.absent;
        return (
          <Pressable key={d.date} onPress={() => onDayPress(i)}
            style={[ds.day, { backgroundColor: bg }, isActive && ds.dayActive]}
          >
            <Text style={[ds.dayNum, isActive && ds.dayNumActive]}>{parseInt(d.date.slice(8), 10)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ds = StyleSheet.create({
  strip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 6 },
  day: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    justifyContent: "center", alignItems: "center",
  },
  dayActive: { borderWidth: 2, borderColor: "#fff" },
  dayNum: { fontSize: FONT.sm, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  dayNumActive: { color: "#fff", fontWeight: "700" },
});

// ── Puzzle game ──
function PuzzleGame({ date, isCatchUp, height }: { date: string; isCatchUp: boolean; height: number }) {
  const todayQuery = usePuzzleToday();
  const catchUpQuery = usePuzzleByDate(date, isCatchUp);
  const puzzle = isCatchUp ? catchUpQuery : todayQuery;
  const submitGuess = useSubmitGuess();

  const [guesses, setGuesses] = useState<{ word: string; result: LetterResult[] }[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [finalResult, setFinalResult] = useState<GuessResponse | null>(null);
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());
  const [winRow, setWinRow] = useState(-1);
  const [restored, setRestored] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const data = puzzle.data as PuzzleTodayResponse | undefined;
  const wl = data?.config?.wordLength ?? 5;
  const maxAttempts = data?.config?.maxAttempts ?? 6;

  // Restore session from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY(date)).then((raw) => {
      if (!raw) { setRestored(true); return; }
      try {
        const session: SessionData = JSON.parse(raw);
        if (session.guesses.length > 0) {
          setGuesses(session.guesses);
          setRevealedRows(new Set(session.guesses.map((_, i) => i)));
          if (session.gameOver && session.finalResult) {
            setGameOver(true);
            setFinalResult(session.finalResult);
            bannerAnim.setValue(1);
            if (session.finalResult.solved) {
              setWinRow(session.guesses.length - 1);
            }
          }
        }
      } catch {}
      setRestored(true);
    }).catch(() => setRestored(true));
  }, [date]);

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
          const newGuesses = [...guesses, { word: guess, result: res.result }];
          setGuesses(newGuesses);
          setCurrentInput("");
          // Keep keyboard open for next guess
          setTimeout(() => inputRef.current?.focus(), 100);
          setTimeout(() => setRevealedRows((prev) => new Set(prev).add(newIdx)), 50);

          const isOver = res.solved || res.attemptsUsed >= res.maxAttempts;
          // Persist session
          const session: SessionData = {
            guesses: newGuesses,
            gameOver: isOver,
            finalResult: isOver ? res : null,
          };
          AsyncStorage.setItem(SESSION_KEY(date), JSON.stringify(session)).catch(() => {});

          if (res.solved) {
            setTimeout(() => setWinRow(newIdx), wl * 200 + 400);
            setTimeout(() => {
              setGameOver(true);
              setFinalResult(res);
              Animated.timing(bannerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
            }, wl * 200 + 800);
          } else if (res.attemptsUsed >= res.maxAttempts) {
            setTimeout(() => {
              setGameOver(true);
              setFinalResult(res);
              Animated.timing(bannerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
            }, wl * 200 + 400);
          }
        },
        onError: () => {
          shake();
          setTimeout(() => {
            setCurrentInput("");
            inputRef.current?.focus();
          }, 300);
        },
      },
    );
  }, [currentInput, wl, data, gameOver, submitGuess, guesses.length]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  if (puzzle.isLoading || !restored) return <View style={[gs.center, { height }]}><ActivityIndicator color={COLORS.accent} /></View>;

  if (puzzle.error || !data) {
    const msg = (puzzle.error as any)?.message ?? "";
    if (msg.includes("deja complete")) {
      return <View style={[gs.center, { height }]}><Text style={gs.doneText}>Deja joue !</Text></View>;
    }
    return (
      <View style={[gs.center, { height }]}>
        <Text style={gs.errorText}>{msg || "Erreur de chargement"}</Text>
        <Pressable style={gs.retryBtn} onPress={() => puzzle.refetch()}>
          <Text style={gs.retryBtnText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable style={{ height }} onPress={focusInput}>
      {/* Catch-up indicator */}
      {isCatchUp && !gameOver && (
        <View style={gs.catchUpBanner}>
          <Text style={gs.catchUpText}>
            Rattrapage {parseInt(date.slice(8), 10)}/{parseInt(date.slice(5, 7), 10)} — x0.5
          </Text>
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

      {/* Input bar */}
      {!gameOver && (
        <View style={gs.inputBar}>
          <TextInput
            ref={inputRef}
            style={gs.textInput}
            value={currentInput}
            onChangeText={(t) => setCurrentInput(t.replace(/[^a-zA-Z]/g, "").slice(0, wl))}
            onSubmitEditing={handleSubmit}
            maxLength={wl}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            returnKeyType="send"
            blurOnSubmit={false}
            editable={!submitGuess.isPending}
            placeholder={`${wl} lettres`}
            placeholderTextColor={COLORS.textMuted}
          />
          <Pressable
            style={[gs.sendBtn, currentInput.length < wl && gs.sendBtnDisabled]}
            onPress={handleSubmit}
            disabled={currentInput.length < wl || submitGuess.isPending}
          >
            <Text style={gs.sendBtnText}>{submitGuess.isPending ? "..." : "\u2713"}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ── Main ──
export default function PuzzleScreen() {
  const monthStatus = useMonthStatus();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState(SH - 200);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const daysList: { date: string; status: string }[] = [];
  let todayIndex = 0;
  if (monthStatus.data) {
    const entries = Object.entries(monthStatus.data.days).sort(([a], [b]) => a.localeCompare(b));
    for (const [date, status] of entries) {
      if (status === "today") todayIndex = daysList.length;
      daysList.push({ date, status });
    }
  }

  const onViewable = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }, []);

  if (monthStatus.isLoading || daysList.length === 0) {
    return <View style={gs.center}><ActivityIndicator color={COLORS.accent} /></View>;
  }

  const activeIdx = currentIndex ?? todayIndex;

  return (
    <View
      style={gs.container}
      onLayout={(e) => {
        setContentHeight(e.nativeEvent.layout.height - 60);
      }}
    >
      <DayStrip
        days={daysList}
        currentIndex={activeIdx}
        onDayPress={(i) => flatListRef.current?.scrollToIndex({ index: i, animated: true })}
      />
      <FlatList
        ref={flatListRef}
        horizontal
        pagingEnabled
        data={daysList}
        keyExtractor={(item) => item.date}
        initialScrollIndex={todayIndex}
        getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewabilityConfig}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width: SW, height: contentHeight }}>
            {item.status === "completed" ? (
              <View style={[gs.center, { height: contentHeight }]}>
                <Text style={{ fontSize: 32 }}>{"\u2705"}</Text>
                <Text style={gs.doneText}>Termine !</Text>
              </View>
            ) : (
              <PuzzleGame key={item.date} date={item.date} isCatchUp={item.status === "missed"} height={contentHeight} />
            )}
          </View>
        )}
      />
    </View>
  );
}

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: FONT.md, color: COLORS.textSecondary, textAlign: "center", padding: SPACING.lg, marginBottom: SPACING.sm },
  retryBtn: { backgroundColor: COLORS.accent, paddingVertical: 10, paddingHorizontal: 24, borderRadius: RADIUS.md },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: FONT.sm },
  doneText: { fontSize: FONT.lg, color: COLORS.correct, fontWeight: "600" },
  catchUpBanner: { backgroundColor: COLORS.present, paddingVertical: 4, alignItems: "center" },
  catchUpText: { color: "#fff", fontSize: FONT.xs, fontWeight: "600" },
  banner: { padding: SPACING.md, alignItems: "center" },
  bannerWin: { backgroundColor: COLORS.correct },
  bannerLose: { backgroundColor: COLORS.absent },
  bannerText: { color: "#fff", fontSize: FONT.xl, fontWeight: "700" },
  bannerSub: { color: "rgba(255,255,255,0.7)", fontSize: FONT.sm, marginTop: SPACING.xs },
  grid: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  gridRow: { flexDirection: "row", gap: 4 },
  inputBar: {
    flexDirection: "row", paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    gap: SPACING.sm, alignItems: "center",
  },
  textInput: {
    flex: 1, backgroundColor: COLORS.bgInput, color: COLORS.textPrimary,
    fontSize: FONT.xl, fontWeight: "700", letterSpacing: 6, textAlign: "center",
    paddingVertical: 12, borderRadius: RADIUS.md, textTransform: "uppercase",
    borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    backgroundColor: COLORS.accent, width: 48, height: 48, borderRadius: RADIUS.md,
    justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { color: "#fff", fontSize: 22, fontWeight: "700" },
});
