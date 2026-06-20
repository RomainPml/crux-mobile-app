import { View, Text, Pressable, StyleSheet } from "react-native";
import type { PuzzleClue } from "@crux/shared";

interface Props {
  clues: PuzzleClue[];
  usedClues: Set<number>;
  onToggle: (clueId: number) => void;
}

export default function ClueList({ clues, usedClues, onToggle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Indices</Text>
      {clues.map((clue) => {
        const used = usedClues.has(clue.id);
        return (
          <Pressable
            key={clue.id}
            style={[styles.clue, used && styles.clueUsed]}
            onPress={() => onToggle(clue.id)}
          >
            <Text style={[styles.clueText, used && styles.clueTextUsed]}>
              {clue.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  clue: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f7f7f7",
    marginBottom: 4,
  },
  clueUsed: {
    backgroundColor: "#f0f0f0",
  },
  clueText: {
    fontSize: 13,
    color: "#333",
  },
  clueTextUsed: {
    color: "#bbb",
    textDecorationLine: "line-through",
  },
});
