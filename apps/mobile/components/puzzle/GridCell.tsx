import { Pressable, Text, StyleSheet } from "react-native";
import type { CellValue } from "../../lib/puzzle-state";

interface Props {
  value: CellValue;
  onPress: () => void;
}

const SYMBOLS: Record<CellValue, string> = {
  unknown: "",
  yes: "\u2713",
  no: "\u2717",
};

const BG: Record<CellValue, string> = {
  unknown: "#fff",
  yes: "#d4edda",
  no: "#f8f8f8",
};

const FG: Record<CellValue, string> = {
  unknown: "#ccc",
  yes: "#155724",
  no: "#ccc",
};

export default function GridCell({ value, onPress }: Props) {
  return (
    <Pressable
      style={[styles.cell, { backgroundColor: BG[value] }]}
      onPress={onPress}
      hitSlop={2}
    >
      <Text style={[styles.text, { color: FG[value] }]}>{SYMBOLS[value]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: 36,
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
