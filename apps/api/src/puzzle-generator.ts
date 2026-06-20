import type { PuzzleGrid, PuzzleCategory, PuzzleClue, ClueType } from "@crux/shared";

// ── Seeded PRNG (mulberry32) ──

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number, rng: () => number): T[] {
  return shuffle(arr, rng).slice(0, n);
}

// ── Category pools ──

const CATEGORY_POOLS: { id: string; label: string; items: string[] }[] = [
  { id: "color", label: "Couleur", items: ["Rouge", "Bleu", "Vert", "Jaune"] },
  { id: "animal", label: "Animal", items: ["Chat", "Chien", "Oiseau", "Poisson"] },
  { id: "food", label: "Plat", items: ["Pizza", "Sushi", "Pasta", "Tacos"] },
  { id: "country", label: "Pays", items: ["France", "Japon", "Italie", "Bresil"] },
  { id: "sport", label: "Sport", items: ["Tennis", "Foot", "Natation", "Velo"] },
  { id: "music", label: "Musique", items: ["Piano", "Guitare", "Violon", "Batterie"] },
  { id: "drink", label: "Boisson", items: ["Cafe", "The", "Jus", "Eau"] },
  { id: "job", label: "Metier", items: ["Medecin", "Artiste", "Prof", "Ingenieur"] },
  { id: "hobby", label: "Loisir", items: ["Lecture", "Cinema", "Voyage", "Cuisine"] },
  { id: "season", label: "Saison", items: ["Printemps", "Ete", "Automne", "Hiver"] },
];

// ── Solution generation ──

export interface PuzzleSolution {
  rows: Record<string, string>[]; // 4 rows, each mapping categoryId -> item
}

function generateSolution(
  categories: PuzzleCategory[],
  rng: () => number,
): PuzzleSolution {
  // First category items define the rows (in shuffled order)
  const rows: Record<string, string>[] = [];
  const shuffledItems = categories.map((c) => shuffle([...c.items], rng));

  for (let row = 0; row < 4; row++) {
    const entry: Record<string, string> = {};
    for (let c = 0; c < categories.length; c++) {
      entry[categories[c].id] = shuffledItems[c][row];
    }
    rows.push(entry);
  }

  return { rows };
}

// ── Clue generation ──

interface RawClue {
  type: ClueType;
  text: string;
  // For solver: the constraint this clue represents
  constraint: (sol: Record<string, string>[]) => boolean;
}

function generateClues(
  categories: PuzzleCategory[],
  solution: PuzzleSolution,
  difficulty: number,
  rng: () => number,
): RawClue[] {
  const clues: RawClue[] = [];
  const rows = solution.rows;

  // Generate candidate clues
  const candidates: RawClue[] = [];

  for (let ci = 0; ci < categories.length; ci++) {
    for (let cj = ci + 1; cj < categories.length; cj++) {
      const catA = categories[ci];
      const catB = categories[cj];

      for (const row of rows) {
        const itemA = row[catA.id];
        const itemB = row[catB.id];

        // Direct positive: "The person with itemA has itemB"
        candidates.push({
          type: "direct_positive",
          text: `${itemA} va avec ${itemB}`,
          constraint: (sol) => sol.some((r) => r[catA.id] === itemA && r[catB.id] === itemB),
        });

        // Direct negative: pick a non-matching item from catB
        const otherItems = catB.items.filter((i) => i !== itemB);
        const otherItem = otherItems[Math.floor(rng() * otherItems.length)];
        candidates.push({
          type: "direct_negative",
          text: `${itemA} ne va pas avec ${otherItem}`,
          constraint: (sol) => sol.every((r) => !(r[catA.id] === itemA && r[catB.id] === otherItem)),
        });
      }

      // Either/or clues
      const rowA = rows[Math.floor(rng() * 4)];
      const itemA = rowA[catA.id];
      const correctB = rowA[catB.id];
      const wrongB = catB.items.filter((i) => i !== correctB)[Math.floor(rng() * 3)];
      candidates.push({
        type: "either_or",
        text: `${itemA} va avec ${correctB} ou ${wrongB}`,
        constraint: (sol) =>
          sol.some(
            (r) => r[catA.id] === itemA && (r[catB.id] === correctB || r[catB.id] === wrongB),
          ),
      });
    }
  }

  // Shuffle candidates and select based on difficulty
  const shuffled = shuffle(candidates, rng);

  // Start with a few direct positives to make it solvable, then add others
  const directPos = shuffled.filter((c) => c.type === "direct_positive");
  const others = shuffled.filter((c) => c.type !== "direct_positive");

  // Difficulty controls how many direct hints vs indirect
  const directCount = Math.max(2, 5 - difficulty); // diff 1 = 4 direct, diff 5 = 2 direct
  const otherCount = Math.max(2, difficulty); // diff 1 = 2 others, diff 5 = 5 others

  clues.push(...directPos.slice(0, directCount));
  clues.push(...others.slice(0, otherCount));

  return clues;
}

// ── Constraint propagation solver ──

type CellState = "unknown" | "yes" | "no";

interface SolverGrid {
  // grid[catA][itemA][catB][itemB] = state
  cells: Map<string, CellState>;
  categories: PuzzleCategory[];
}

function cellKey(catA: string, itemA: string, catB: string, itemB: string): string {
  // Normalize order
  if (catA > catB) return `${catB}:${itemB}:${catA}:${itemA}`;
  return `${catA}:${itemA}:${catB}:${itemB}`;
}

function createGrid(categories: PuzzleCategory[]): SolverGrid {
  const cells = new Map<string, CellState>();
  for (let ci = 0; ci < categories.length; ci++) {
    for (let cj = ci + 1; cj < categories.length; cj++) {
      for (const itemA of categories[ci].items) {
        for (const itemB of categories[cj].items) {
          cells.set(cellKey(categories[ci].id, itemA, categories[cj].id, itemB), "unknown");
        }
      }
    }
  }
  return { cells, categories };
}

function setCell(grid: SolverGrid, catA: string, itemA: string, catB: string, itemB: string, state: CellState): boolean {
  const key = cellKey(catA, itemA, catB, itemB);
  const current = grid.cells.get(key);
  if (current === state) return false; // no change
  if (current !== "unknown" && current !== state) return false; // contradiction — ignore
  grid.cells.set(key, state);
  return true;
}

function getCell(grid: SolverGrid, catA: string, itemA: string, catB: string, itemB: string): CellState {
  return grid.cells.get(cellKey(catA, itemA, catB, itemB)) ?? "unknown";
}

function propagate(grid: SolverGrid): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (let ci = 0; ci < grid.categories.length; ci++) {
      for (let cj = ci + 1; cj < grid.categories.length; cj++) {
        const catA = grid.categories[ci];
        const catB = grid.categories[cj];

        for (const itemA of catA.items) {
          // If itemA has a YES with some itemB, all other itemB' must be NO
          const yesItems = catB.items.filter((ib) => getCell(grid, catA.id, itemA, catB.id, ib) === "yes");
          if (yesItems.length === 1) {
            for (const ib of catB.items) {
              if (ib !== yesItems[0] && getCell(grid, catA.id, itemA, catB.id, ib) === "unknown") {
                setCell(grid, catA.id, itemA, catB.id, ib, "no");
                changed = true;
              }
            }
            // Also: no other itemA' can have YES with this itemB
            for (const ia of catA.items) {
              if (ia !== itemA && getCell(grid, catA.id, ia, catB.id, yesItems[0]) === "unknown") {
                setCell(grid, catA.id, ia, catB.id, yesItems[0], "no");
                changed = true;
              }
            }
          }

          // If all but one itemB are NO, the remaining must be YES
          const unknownItems = catB.items.filter((ib) => getCell(grid, catA.id, itemA, catB.id, ib) === "unknown");
          if (unknownItems.length === 1 && yesItems.length === 0) {
            setCell(grid, catA.id, itemA, catB.id, unknownItems[0], "yes");
            changed = true;
          }
        }

        // Same from catB perspective
        for (const itemB of catB.items) {
          const yesItems = catA.items.filter((ia) => getCell(grid, catA.id, ia, catB.id, itemB) === "yes");
          if (yesItems.length === 1) {
            for (const ia of catA.items) {
              if (ia !== yesItems[0] && getCell(grid, catA.id, ia, catB.id, itemB) === "unknown") {
                setCell(grid, catA.id, ia, catB.id, itemB, "no");
                changed = true;
              }
            }
          }
          const unknownItems = catA.items.filter((ia) => getCell(grid, catA.id, ia, catB.id, itemB) === "unknown");
          if (unknownItems.length === 1 && yesItems.length === 0) {
            setCell(grid, catA.id, unknownItems[0], catB.id, itemB, "yes");
            changed = true;
          }
        }

        // Cross-category inference: if A1-B1 = YES and B1-C1 = YES, then A1-C1 = YES
        for (let ck = 0; ck < grid.categories.length; ck++) {
          if (ck === ci || ck === cj) continue;
          const catC = grid.categories[ck];
          for (const itemA of catA.items) {
            for (const itemB of catB.items) {
              if (getCell(grid, catA.id, itemA, catB.id, itemB) !== "yes") continue;
              for (const itemC of catC.items) {
                const bc = getCell(grid, catB.id, itemB, catC.id, itemC);
                const ac = getCell(grid, catA.id, itemA, catC.id, itemC);
                if (bc === "yes" && ac === "unknown") {
                  setCell(grid, catA.id, itemA, catC.id, itemC, "yes");
                  changed = true;
                }
                if (bc === "no" && ac === "unknown") {
                  setCell(grid, catA.id, itemA, catC.id, itemC, "no");
                  changed = true;
                }
                if (ac === "yes" && bc === "unknown") {
                  setCell(grid, catB.id, itemB, catC.id, itemC, "yes");
                  changed = true;
                }
                if (ac === "no" && bc === "unknown") {
                  setCell(grid, catB.id, itemB, catC.id, itemC, "no");
                  changed = true;
                }
              }
            }
          }
        }
      }
    }
  }
  return true;
}

function isSolved(grid: SolverGrid): boolean {
  for (const state of grid.cells.values()) {
    if (state === "unknown") return false;
  }
  return true;
}

function applyClue(grid: SolverGrid, clue: RawClue, categories: PuzzleCategory[]): void {
  if (clue.type === "direct_positive") {
    // Parse "ItemA va avec ItemB"
    const match = clue.text.match(/^(.+) va avec (.+)$/);
    if (!match) return;
    const [, itemA, itemB] = match;
    const catA = categories.find((c) => c.items.includes(itemA));
    const catB = categories.find((c) => c.items.includes(itemB));
    if (catA && catB) {
      setCell(grid, catA.id, itemA, catB.id, itemB, "yes");
    }
  } else if (clue.type === "direct_negative") {
    const match = clue.text.match(/^(.+) ne va pas avec (.+)$/);
    if (!match) return;
    const [, itemA, itemB] = match;
    const catA = categories.find((c) => c.items.includes(itemA));
    const catB = categories.find((c) => c.items.includes(itemB));
    if (catA && catB) {
      setCell(grid, catA.id, itemA, catB.id, itemB, "no");
    }
  } else if (clue.type === "either_or") {
    const match = clue.text.match(/^(.+) va avec (.+) ou (.+)$/);
    if (!match) return;
    const [, itemA, itemB1, itemB2] = match;
    const catA = categories.find((c) => c.items.includes(itemA));
    const catB = categories.find((c) => c.items.includes(itemB1));
    if (catA && catB) {
      // All items in catB that are not B1 or B2 must be NO
      for (const ib of catB.items) {
        if (ib !== itemB1 && ib !== itemB2) {
          setCell(grid, catA.id, itemA, catB.id, ib, "no");
        }
      }
    }
  }
}

function solveWithClues(categories: PuzzleCategory[], clues: RawClue[]): boolean {
  const grid = createGrid(categories);
  for (const clue of clues) {
    applyClue(grid, clue, categories);
    propagate(grid);
  }
  return isSolved(grid);
}

// ── Main generator ──

export function generatePuzzle(day: string, difficulty: number = 3): {
  grid: PuzzleGrid;
  solution: PuzzleSolution;
} {
  const seed = parseInt(day.replace(/-/g, ""), 10);
  const rng = mulberry32(seed);

  // Pick 4 categories
  const selectedPools = pick(CATEGORY_POOLS, 4, rng);
  const categories: PuzzleCategory[] = selectedPools.map((p) => ({
    id: p.id,
    label: p.label,
    items: shuffle([...p.items], rng),
  }));

  // Generate solution
  const solution = generateSolution(categories, rng);

  // Generate clues and ensure solvability
  let clues: RawClue[];
  let attempts = 0;

  do {
    clues = generateClues(categories, solution, difficulty, mulberry32(seed + attempts));
    attempts++;

    // If not solvable, add more direct positive clues
    if (!solveWithClues(categories, clues)) {
      const allDirect: RawClue[] = [];
      for (let ci = 0; ci < categories.length; ci++) {
        for (let cj = ci + 1; cj < categories.length; cj++) {
          for (const row of solution.rows) {
            const catA = categories[ci];
            const catB = categories[cj];
            allDirect.push({
              type: "direct_positive",
              text: `${row[catA.id]} va avec ${row[catB.id]}`,
              constraint: (sol) =>
                sol.some((r) => r[catA.id] === row[catA.id] && r[catB.id] === row[catB.id]),
            });
          }
        }
      }
      // Add missing direct clues until solvable
      const existing = new Set(clues.map((c) => c.text));
      for (const d of shuffle(allDirect, rng)) {
        if (existing.has(d.text)) continue;
        clues.push(d);
        if (solveWithClues(categories, clues)) break;
      }
    }
  } while (!solveWithClues(categories, clues) && attempts < 10);

  const puzzleClues: PuzzleClue[] = clues.map((c, i) => ({
    id: i,
    text: c.text,
    type: c.type,
  }));

  return {
    grid: { categories, clues: puzzleClues },
    solution,
  };
}
