import { View, Text, StyleSheet } from "react-native";
import GridCell from "./GridCell";
import type { PuzzleCategory } from "@crux/shared";
import type { CellValue } from "../../lib/puzzle-state";
import { cellKey } from "../../lib/puzzle-state";

interface Props {
  catRow: PuzzleCategory;
  catCol: PuzzleCategory;
  cells: Record<string, CellValue>;
  onCellPress: (key: string) => void;
}

export default function GridSection({ catRow, catCol, cells, onCellPress }: Props) {
  return (
    <View style={styles.section}>
      {/* Column headers */}
      <View style={styles.headerRow}>
        <View style={styles.labelCell} />
        {catCol.items.map((item) => (
          <View key={item} style={styles.headerCell}>
            <Text style={styles.headerText} numberOfLines={1}>
              {item.slice(0, 4)}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid rows */}
      {catRow.items.map((rowItem) => (
        <View key={rowItem} style={styles.row}>
          <View style={styles.labelCell}>
            <Text style={styles.labelText} numberOfLines={1}>
              {rowItem.slice(0, 5)}
            </Text>
          </View>
          {catCol.items.map((colItem) => {
            const key = cellKey(catRow.id, rowItem, catCol.id, colItem);
            return (
              <GridCell
                key={key}
                value={cells[key] ?? "unknown"}
                onPress={() => onCellPress(key)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
  },
  headerCell: {
    width: 36,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    fontSize: 9,
    color: "#666",
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
  },
  labelCell: {
    width: 44,
    height: 36,
    justifyContent: "center",
    paddingRight: 4,
  },
  labelText: {
    fontSize: 10,
    color: "#444",
    textAlign: "right",
    fontWeight: "500",
  },
});
