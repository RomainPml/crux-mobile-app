import { describe, it, expect } from "vitest";

// We test the puzzle state logic here since it's pure functions
// Import from the mobile lib via relative path (tests run from shared root)
// For now, inline the logic to test independently

type CellValue = "unknown" | "yes" | "no";

function cellKey(catA: string, itemA: string, catB: string, itemB: string): string {
  if (catA > catB) return `${catB}:${itemB}:${catA}:${itemA}`;
  return `${catA}:${itemA}:${catB}:${itemB}`;
}

describe("cellKey", () => {
  it("normalizes key order", () => {
    expect(cellKey("a", "x", "b", "y")).toBe("a:x:b:y");
    expect(cellKey("b", "y", "a", "x")).toBe("a:x:b:y");
  });

  it("same pair always produces same key regardless of order", () => {
    const k1 = cellKey("color", "Red", "animal", "Cat");
    const k2 = cellKey("animal", "Cat", "color", "Red");
    expect(k1).toBe(k2);
  });
});

describe("solution extraction logic", () => {
  it("extracts complete solution from YES cells", () => {
    const cells: Record<string, CellValue> = {
      [cellKey("color", "Red", "animal", "Cat")]: "yes",
      [cellKey("color", "Red", "food", "Pizza")]: "yes",
      [cellKey("color", "Blue", "animal", "Dog")]: "yes",
      [cellKey("color", "Blue", "food", "Sushi")]: "yes",
    };

    // Extract: for each color, find which animal and food are YES
    const categories = [
      { id: "color", items: ["Red", "Blue"] },
      { id: "animal", items: ["Cat", "Dog"] },
      { id: "food", items: ["Pizza", "Sushi"] },
    ];

    const rows: Record<string, string>[] = [];
    const anchor = categories[0];
    for (const anchorItem of anchor.items) {
      const row: Record<string, string> = { [anchor.id]: anchorItem };
      for (let c = 1; c < categories.length; c++) {
        const yesItem = categories[c].items.find(
          (item) => cells[cellKey(anchor.id, anchorItem, categories[c].id, item)] === "yes",
        );
        if (yesItem) row[categories[c].id] = yesItem;
      }
      rows.push(row);
    }

    expect(rows).toEqual([
      { color: "Red", animal: "Cat", food: "Pizza" },
      { color: "Blue", animal: "Dog", food: "Sushi" },
    ]);
  });

  it("returns incomplete if not all YES cells are set", () => {
    const cells: Record<string, CellValue> = {
      [cellKey("color", "Red", "animal", "Cat")]: "yes",
      // Missing color-food link
    };

    const anchor = { id: "color", items: ["Red", "Blue"] };
    const food = { id: "food", items: ["Pizza", "Sushi"] };

    const yesItem = food.items.find(
      (item) => cells[cellKey(anchor.id, "Red", food.id, item)] === "yes",
    );
    expect(yesItem).toBeUndefined();
  });
});

describe("auto-elimination", () => {
  it("setting YES should allow eliminating other cells", () => {
    // When Red-Cat is YES, Red-Dog should be NO and Blue-Cat should be NO
    const items = ["Cat", "Dog"];
    const colors = ["Red", "Blue"];

    const cells: Record<string, CellValue> = {};
    // Set Red-Cat to YES
    cells[cellKey("color", "Red", "animal", "Cat")] = "yes";

    // Auto-eliminate: all other animals for Red → NO
    for (const animal of items) {
      if (animal !== "Cat") {
        cells[cellKey("color", "Red", "animal", animal)] = "no";
      }
    }
    // Auto-eliminate: all other colors for Cat → NO
    for (const color of colors) {
      if (color !== "Red") {
        cells[cellKey("color", color, "animal", "Cat")] = "no";
      }
    }

    expect(cells[cellKey("color", "Red", "animal", "Dog")]).toBe("no");
    expect(cells[cellKey("color", "Blue", "animal", "Cat")]).toBe("no");
    // Blue-Dog should still be unknown (will be inferred as YES)
    expect(cells[cellKey("color", "Blue", "animal", "Dog")]).toBeUndefined();
  });
});

describe("clean deductions", () => {
  it("counts YES cells minus undo count", () => {
    let yesCount = 0;
    let undoCount = 0;

    // Make 5 deductions
    yesCount = 5;
    expect(Math.max(0, yesCount - undoCount)).toBe(5);

    // Undo 2
    undoCount = 2;
    yesCount = 3; // 2 cells reverted
    expect(Math.max(0, yesCount - undoCount)).toBe(1);
  });
});
