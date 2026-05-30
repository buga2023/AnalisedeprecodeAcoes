import { describe, it, expect, beforeEach } from "vitest";
import {
  TUTORIAL_HINTS,
  isHintDismissed,
  dismissHint,
  resetTutorialHints,
  type HintKey,
} from "./tutorialHints";

beforeEach(() => {
  localStorage.clear();
});

describe("tutorialHints — registro", () => {
  it("tem titulo e corpo nao-vazios para cada feature", () => {
    const keys = Object.keys(TUTORIAL_HINTS) as HintKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(TUTORIAL_HINTS[k].title.trim().length).toBeGreaterThan(0);
      expect(TUTORIAL_HINTS[k].body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("tutorialHints — persistencia da dispensa", () => {
  it("nao dispensado por padrao", () => {
    expect(isHintDismissed("home")).toBe(false);
  });

  it("dismissHint marca como dispensado e persiste", () => {
    dismissHint("home");
    expect(isHintDismissed("home")).toBe(true);
    // sobrevive a uma nova leitura (sem cache em memoria)
    expect(localStorage.getItem("praxia-tutorial-hints")).toContain("home");
  });

  it("dispensas sao independentes por feature", () => {
    dismissHint("home");
    expect(isHintDismissed("home")).toBe(true);
    expect(isHintDismissed("market")).toBe(false);
  });

  it("resetTutorialHints limpa todas as dispensas", () => {
    dismissHint("home");
    dismissHint("market");
    resetTutorialHints();
    expect(isHintDismissed("home")).toBe(false);
    expect(isHintDismissed("market")).toBe(false);
  });

  it("localStorage corrompido nao quebra (trata como nao-dispensado)", () => {
    localStorage.setItem("praxia-tutorial-hints", "{lixo nao-json");
    expect(isHintDismissed("home")).toBe(false);
  });
});
