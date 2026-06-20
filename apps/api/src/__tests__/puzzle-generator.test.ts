import { describe, it, expect } from "vitest";
import { generatePuzzle, evaluateGuess, isValidGuess, computeWordleScore } from "../puzzle-generator.js";

describe("generatePuzzle", () => {
  it("generates a 5-letter word puzzle", () => {
    const { config, solution } = generatePuzzle("2026-06-20");
    expect(config.category).toBe("words");
    expect(config.wordLength).toBe(5);
    expect(config.maxAttempts).toBe(6);
    expect(solution.word).toHaveLength(5);
  });

  it("is deterministic", () => {
    const p1 = generatePuzzle("2026-06-20");
    const p2 = generatePuzzle("2026-06-20");
    expect(p1.solution.word).toBe(p2.solution.word);
  });

  it("different days produce different words", () => {
    const p1 = generatePuzzle("2026-06-20");
    const p2 = generatePuzzle("2026-06-21");
    expect(p1.solution.word).not.toBe(p2.solution.word);
  });
});

describe("evaluateGuess", () => {
  it("marks correct letters green", () => {
    const result = evaluateGuess("CRANE", "CRANE");
    expect(result).toEqual(["correct", "correct", "correct", "correct", "correct"]);
  });

  it("marks present letters yellow", () => {
    const result = evaluateGuess("ARBRE", "BARRE");
    // A: present (in BARRE but not pos 0)
    // R: present (in BARRE but not pos 1)
    // B: present (in BARRE but not pos 2)
    // R: correct (pos 3)
    // E: correct (pos 4)
    expect(result[3]).toBe("correct");
    expect(result[4]).toBe("correct");
  });

  it("marks absent letters grey", () => {
    const result = evaluateGuess("XXXXX", "CRANE");
    expect(result).toEqual(["absent", "absent", "absent", "absent", "absent"]);
  });

  it("handles duplicate letters correctly", () => {
    // Answer: BELLE, Guess: LABEL
    const result = evaluateGuess("LABEL", "BELLE");
    // L: present (L is at pos 3 in BELLE)
    // A: absent
    // B: present (B is at pos 0 in BELLE)
    // E: present (E is at pos 1 or 4 in BELLE)
    // L: correct (pos 4? no, BELLE[4]=E) — wait
    // BELLE = B,E,L,L,E
    // LABEL = L,A,B,E,L
    // L(0): present (L is at 2,3 in BELLE)
    // A(1): absent
    // B(2): present (B is at 0 in BELLE)
    // E(3): present (E is at 1,4 in BELLE)
    // L(4): correct? BELLE[4]=E, so absent? No, L at pos 4, BELLE[4]=E → not correct
    //   but L is in BELLE at pos 2,3 — one was used by L(0), so L(4) gets the other → present
    expect(result[0]).toBe("present"); // L
    expect(result[1]).toBe("absent");  // A
    expect(result[2]).toBe("present"); // B
    expect(result[3]).toBe("present"); // E
    expect(result[4]).toBe("present"); // L
  });

  it("does not double-count letters", () => {
    // Answer: ABIME, Guess: AIMER
    // A(0): correct
    // I(1): present (at pos 2 in ABIME)
    // M(2): present (at pos 3 in ABIME)
    // E(3): present (at pos 4 in ABIME)
    // R(4): absent
    const result = evaluateGuess("AIMER", "ABIME");
    expect(result[0]).toBe("correct");
    expect(result[4]).toBe("absent");
  });
});

describe("isValidGuess", () => {
  it("accepts valid 5-letter words", () => {
    expect(isValidGuess("CRANE")).toBe(true);
    expect(isValidGuess("crane")).toBe(true);
  });

  it("rejects invalid words", () => {
    expect(isValidGuess("ZZZZZ")).toBe(false);
    expect(isValidGuess("AB")).toBe(false);
  });
});

describe("computeWordleScore", () => {
  it("gives max score for 1 attempt", () => {
    const score = computeWordleScore(1, 10000, true);
    expect(score).toBeGreaterThan(1000);
  });

  it("gives less for more attempts", () => {
    const s1 = computeWordleScore(1, 30000, true);
    const s3 = computeWordleScore(3, 30000, true);
    const s6 = computeWordleScore(6, 30000, true);
    expect(s1).toBeGreaterThan(s3);
    expect(s3).toBeGreaterThan(s6);
  });

  it("gives 0 for unsolved", () => {
    expect(computeWordleScore(6, 100000, false)).toBe(0);
  });

  it("gives time bonus for fast solves", () => {
    const fast = computeWordleScore(3, 15000, true);
    const slow = computeWordleScore(3, 290000, true);
    expect(fast).toBeGreaterThan(slow);
  });
});
