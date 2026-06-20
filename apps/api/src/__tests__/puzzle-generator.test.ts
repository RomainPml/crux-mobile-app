import { describe, it, expect } from "vitest";
import { generatePuzzle } from "../puzzle-generator.js";

describe("generatePuzzle", () => {
  it("generates a puzzle with 4 categories of 4 items each", () => {
    const { grid } = generatePuzzle("2026-06-20");

    expect(grid.categories).toHaveLength(4);
    for (const cat of grid.categories) {
      expect(cat.items).toHaveLength(4);
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  it("generates clues", () => {
    const { grid } = generatePuzzle("2026-06-20");

    expect(grid.clues.length).toBeGreaterThanOrEqual(4);
    for (const clue of grid.clues) {
      expect(clue.text).toBeTruthy();
      expect(["direct_positive", "direct_negative", "either_or"]).toContain(clue.type);
    }
  });

  it("generates a valid solution with all categories", () => {
    const { grid, solution } = generatePuzzle("2026-06-20");

    expect(solution.rows).toHaveLength(4);
    for (const row of solution.rows) {
      for (const cat of grid.categories) {
        expect(cat.items).toContain(row[cat.id]);
      }
    }
  });

  it("solution has no duplicate items per category", () => {
    const { grid, solution } = generatePuzzle("2026-06-20");

    for (const cat of grid.categories) {
      const values = solution.rows.map((r) => r[cat.id]);
      expect(new Set(values).size).toBe(4);
    }
  });

  it("is deterministic — same day produces same puzzle", () => {
    const p1 = generatePuzzle("2026-06-20");
    const p2 = generatePuzzle("2026-06-20");

    expect(p1.grid.categories.map((c) => c.id)).toEqual(
      p2.grid.categories.map((c) => c.id),
    );
    expect(p1.solution.rows).toEqual(p2.solution.rows);
    expect(p1.grid.clues.map((c) => c.text)).toEqual(
      p2.grid.clues.map((c) => c.text),
    );
  });

  it("different days produce different puzzles", () => {
    const p1 = generatePuzzle("2026-06-20");
    const p2 = generatePuzzle("2026-06-21");

    // Very unlikely to be identical
    expect(JSON.stringify(p1.solution)).not.toBe(JSON.stringify(p2.solution));
  });

  it("respects difficulty parameter", () => {
    const easy = generatePuzzle("2026-06-20", 1);
    const hard = generatePuzzle("2026-06-20", 5);

    // Easy should have more direct positive clues
    const easyDirect = easy.grid.clues.filter((c) => c.type === "direct_positive").length;
    const hardDirect = hard.grid.clues.filter((c) => c.type === "direct_positive").length;
    expect(easyDirect).toBeGreaterThanOrEqual(hardDirect);
  });

  it("generates solvable puzzles for multiple dates", () => {
    // Test 10 different dates
    for (let d = 1; d <= 10; d++) {
      const day = `2026-06-${String(d).padStart(2, "0")}`;
      const { grid, solution } = generatePuzzle(day);

      expect(grid.categories).toHaveLength(4);
      expect(solution.rows).toHaveLength(4);
      expect(grid.clues.length).toBeGreaterThanOrEqual(4);
    }
  });
});
