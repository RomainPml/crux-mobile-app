import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useReducer, useCallback, useState } from "react";
import type { PuzzleGrid } from "@crux/shared";
import {
  initPuzzleState,
  puzzleReducer,
  extractSolution,
  getCleanDeductions,
} from "../../lib/puzzle-state";
import GridSection from "./GridSection";
import ClueList from "./ClueList";
import Timer from "./Timer";

interface Props {
  grid: PuzzleGrid;
  onSubmit: (solution: Record<string, string>[], cleanDeductions: number) => void;
  submitted?: boolean;
}

export default function PuzzleBoard({ grid, onSubmit, submitted }: Props) {
  const [state, dispatch] = useReducer(puzzleReducer, grid, initPuzzleState);
  const [activeSection, setActiveSection] = useState(0);

  const cats = grid.categories;

  // Generate all category pairs (6 sections for 4 categories)
  const sections: [number, number][] = [];
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      sections.push([i, j]);
    }
  }

  const handleCellPress = useCallback(
    (key: string) => {
      if (submitted) return;
      dispatch({ type: "TAP_CELL", key });
    },
    [submitted],
  );

  const handleUndo = useCallback(() => {
    if (submitted) return;
    dispatch({ type: "UNDO" });
  }, [submitted]);

  const handleSubmit = () => {
    const solution = extractSolution(state);
    if (!solution) {
      Alert.alert("Incomplet", "Completez la grille avant de soumettre");
      return;
    }
    onSubmit(solution, getCleanDeductions(state));
  };

  const [rowCat, colCat] = sections[activeSection];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Timer startTime={state.startTime} stopped={submitted} />
        {!submitted && (
          <Pressable style={styles.undoBtn} onPress={handleUndo}>
            <Text style={styles.undoBtnText}>Annuler</Text>
          </Pressable>
        )}
      </View>

      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {sections.map(([i, j], idx) => (
          <Pressable
            key={`${i}-${j}`}
            style={[styles.tab, activeSection === idx && styles.tabActive]}
            onPress={() => setActiveSection(idx)}
          >
            <Text style={[styles.tabText, activeSection === idx && styles.tabTextActive]}>
              {cats[i].label.slice(0, 3)} / {cats[j].label.slice(0, 3)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Active grid section */}
      <View style={styles.gridContainer}>
        <GridSection
          catRow={cats[rowCat]}
          catCol={cats[colCat]}
          cells={state.cells}
          onCellPress={handleCellPress}
        />
      </View>

      {/* Submit button */}
      {!submitted && (
        <Pressable style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>Soumettre</Text>
        </Pressable>
      )}

      {/* Clues */}
      <ClueList
        clues={grid.clues}
        usedClues={state.usedClues}
        onToggle={(id) => dispatch({ type: "TOGGLE_CLUE", clueId: id })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  undoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  undoBtnText: { fontSize: 13, color: "#666" },
  tabs: {
    marginBottom: 12,
    flexGrow: 0,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    marginRight: 6,
  },
  tabActive: {
    backgroundColor: "#1a1a1a",
  },
  tabText: { fontSize: 12, color: "#666" },
  tabTextActive: { color: "#fff" },
  gridContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
