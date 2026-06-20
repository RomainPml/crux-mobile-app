import type { PuzzleGrid } from "@crux/shared";

export type CellValue = "unknown" | "yes" | "no";

export interface PuzzleState {
  grid: PuzzleGrid;
  // cells[catA:itemA:catB:itemB] = CellValue
  cells: Record<string, CellValue>;
  usedClues: Set<number>;
  history: string[]; // stack of cell keys for undo
  undoCount: number;
  startTime: number;
}

export type PuzzleAction =
  | { type: "TAP_CELL"; key: string }
  | { type: "TOGGLE_CLUE"; clueId: number }
  | { type: "UNDO" };

export function cellKey(catA: string, itemA: string, catB: string, itemB: string): string {
  if (catA > catB) return `${catB}:${itemB}:${catA}:${itemA}`;
  return `${catA}:${itemA}:${catB}:${itemB}`;
}

function nextValue(current: CellValue): CellValue {
  if (current === "unknown") return "yes";
  if (current === "yes") return "no";
  return "unknown";
}

export function initPuzzleState(grid: PuzzleGrid): PuzzleState {
  const cells: Record<string, CellValue> = {};
  const cats = grid.categories;
  for (let ci = 0; ci < cats.length; ci++) {
    for (let cj = ci + 1; cj < cats.length; cj++) {
      for (const itemA of cats[ci].items) {
        for (const itemB of cats[cj].items) {
          cells[cellKey(cats[ci].id, itemA, cats[cj].id, itemB)] = "unknown";
        }
      }
    }
  }
  return { grid, cells, usedClues: new Set(), history: [], undoCount: 0, startTime: Date.now() };
}

export function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState {
  switch (action.type) {
    case "TAP_CELL": {
      const current = state.cells[action.key] ?? "unknown";
      const next = nextValue(current);
      const newCells = { ...state.cells, [action.key]: next };

      // If setting to YES, auto-eliminate in same row/col
      if (next === "yes") {
        const [catA, itemA, catB, itemB] = action.key.split(":");
        // All other items in catB for this itemA → NO
        for (const item of state.grid.categories.find((c) => c.id === catB)?.items ?? []) {
          if (item !== itemB) {
            const k = cellKey(catA, itemA, catB, item);
            if (newCells[k] === "unknown") newCells[k] = "no";
          }
        }
        // All other items in catA for this itemB → NO
        for (const item of state.grid.categories.find((c) => c.id === catA)?.items ?? []) {
          if (item !== itemA) {
            const k = cellKey(catA, item, catB, itemB);
            if (newCells[k] === "unknown") newCells[k] = "no";
          }
        }
      }

      return {
        ...state,
        cells: newCells,
        history: [...state.history, action.key],
      };
    }

    case "TOGGLE_CLUE": {
      const newUsed = new Set(state.usedClues);
      if (newUsed.has(action.clueId)) newUsed.delete(action.clueId);
      else newUsed.add(action.clueId);
      return { ...state, usedClues: newUsed };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      const lastKey = state.history[state.history.length - 1];
      return {
        ...state,
        cells: { ...state.cells, [lastKey]: "unknown" },
        history: state.history.slice(0, -1),
        undoCount: state.undoCount + 1,
      };
    }
  }
}

export function extractSolution(state: PuzzleState): Record<string, string>[] | null {
  const cats = state.grid.categories;
  const rows: Record<string, string>[] = [];

  // Use first category as anchor — find which items from other categories are YES
  const anchor = cats[0];
  for (const anchorItem of anchor.items) {
    const row: Record<string, string> = { [anchor.id]: anchorItem };
    let complete = true;
    for (let c = 1; c < cats.length; c++) {
      const yesItem = cats[c].items.find(
        (item) => state.cells[cellKey(anchor.id, anchorItem, cats[c].id, item)] === "yes",
      );
      if (yesItem) {
        row[cats[c].id] = yesItem;
      } else {
        complete = false;
      }
    }
    if (!complete) return null;
    rows.push(row);
  }
  return rows;
}

export function getCleanDeductions(state: PuzzleState): number {
  // Count YES cells minus undo count
  const yesCount = Object.values(state.cells).filter((v) => v === "yes").length;
  return Math.max(0, yesCount - state.undoCount);
}
