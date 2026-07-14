/**
 * Tests for decisionOptions — extractOptions and decisionPrompt.
 */
import { describe, it, expect } from "vitest";
import { extractOptions, decisionPrompt } from "./decisionOptions";
import type { RedactedEngineMessage } from "@yugioh-app/contracts";

function msg(name: string, extra: Record<string, unknown> = {}): RedactedEngineMessage {
  return { name, engineType: 0, ...extra };
}

describe("extractOptions — SELECT_IDLECMD", () => {
  it("returns options array", () => {
    const m = msg("SELECT_IDLECMD", {
      options: [
        { label: "Normal Summon", index: 0 },
        { label: "End Phase", index: 1 },
      ],
    });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(2);
    expect(opts).toContainEqual(expect.objectContaining({ label: "Normal Summon", value: 0 }));
    expect(opts).toContainEqual(expect.objectContaining({ label: "End Phase", value: 1 }));
  });

  it("returns empty array for missing options key", () => {
    const opts = extractOptions(msg("SELECT_IDLECMD"));
    expect(opts).toEqual([]);
  });
});

describe("extractOptions — SELECT_BATTLECMD", () => {
  it("returns battle options", () => {
    const m = msg("SELECT_BATTLECMD", {
      options: [
        { label: "Attack", index: 0 },
        { label: "End Battle", index: 1 },
      ],
    });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(2);
    expect(opts).toContainEqual(expect.objectContaining({ label: "End Battle", value: 1 }));
  });
});

describe("extractOptions — SELECT_CHAIN", () => {
  it("appends a pass option when canPass is true", () => {
    const m = msg("SELECT_CHAIN", {
      options: [{ label: "Activate Trap", index: 0 }],
      canPass: true,
    });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(2);
    const passOpt = opts.find((o) => o.isPass);
    expect(passOpt).toBeTruthy();
    expect(passOpt?.label).toMatch(/no response/i);
  });

  it("does not append pass option when canPass is false", () => {
    const m = msg("SELECT_CHAIN", {
      options: [{ label: "Activate Trap", index: 0 }],
      canPass: false,
    });
    const opts = extractOptions(m);
    expect(opts.some((o) => o.isPass)).toBe(false);
  });
});

describe("extractOptions — SELECT_CARD", () => {
  it("returns cards with name + index", () => {
    const m = msg("SELECT_CARD", {
      cards: [
        { name: "Dark Magician", code: 46986414, index: 0 },
        { name: "Blue-Eyes", code: 89631139, index: 1 },
      ],
    });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(2);
    expect(opts).toContainEqual(expect.objectContaining({ label: "Dark Magician", value: 0 }));
  });
});

describe("extractOptions — SELECT_EFFECTYN / SELECT_YESNO", () => {
  it("returns Yes and No for SELECT_EFFECTYN", () => {
    const opts = extractOptions(msg("SELECT_EFFECTYN", { question: "Activate?" }));
    expect(opts).toHaveLength(2);
    expect(opts).toContainEqual(expect.objectContaining({ label: "Yes", value: 1 }));
    expect(opts).toContainEqual(expect.objectContaining({ label: "No", value: 0 }));
  });

  it("returns Yes and No for SELECT_YESNO", () => {
    const opts = extractOptions(msg("SELECT_YESNO", { question: "Send to GY?" }));
    expect(opts).toHaveLength(2);
    expect(opts.find((o) => o.label === "Yes")).toBeTruthy();
  });
});

describe("extractOptions — SELECT_OPTION", () => {
  it("extracts option list", () => {
    const m = msg("SELECT_OPTION", {
      options: [
        { label: "Effect A", index: 0 },
        { label: "Effect B", index: 1 },
      ],
    });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(2);
    expect(opts.find((o) => o.label === "Effect A")).toBeTruthy();
  });
});

describe("extractOptions — SELECT_POSITION", () => {
  it("extracts position list", () => {
    const m = msg("SELECT_POSITION", {
      positions: [
        { label: "Attack Position", value: 2 },
        { label: "Defense Position", value: 4 },
      ],
    });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(2);
    expect(opts).toContainEqual(expect.objectContaining({ label: "Attack Position", value: 2 }));
  });
});

describe("extractOptions — SELECT_TRIBUTE", () => {
  it("extracts tribute cards", () => {
    const m = msg("SELECT_TRIBUTE", {
      cards: [{ name: "Dark Magician", index: 0 }],
    });
    const opts = extractOptions(m);
    expect(opts).toContainEqual(expect.objectContaining({ label: "Dark Magician", value: 0 }));
  });
});

describe("extractOptions — ANNOUNCE_ATTRIB", () => {
  it("returns all 7 attributes", () => {
    const opts = extractOptions(msg("ANNOUNCE_ATTRIB"));
    expect(opts.length).toBe(7);
    expect(opts.map((o) => o.label)).toContain("DARK");
    expect(opts.map((o) => o.label)).toContain("LIGHT");
  });
});

describe("extractOptions — ANNOUNCE_NUMBER", () => {
  it("returns number options", () => {
    const m = msg("ANNOUNCE_NUMBER", { numbers: [1, 2, 3] });
    const opts = extractOptions(m);
    expect(opts).toHaveLength(3);
    expect(opts).toContainEqual(expect.objectContaining({ label: "1", value: 1 }));
  });
});

describe("extractOptions — unknown name", () => {
  it("returns empty array", () => {
    const opts = extractOptions(msg("SOME_FUTURE_MSG"));
    expect(opts).toEqual([]);
  });
});

describe("decisionPrompt", () => {
  it("returns action prompt for SELECT_IDLECMD", () => {
    expect(decisionPrompt(msg("SELECT_IDLECMD"))).toMatch(/action/i);
  });

  it("returns question string from SELECT_CHAIN", () => {
    const prompt = decisionPrompt(msg("SELECT_CHAIN", { question: "Respond to Dark Magician?" }));
    expect(prompt).toBe("Respond to Dark Magician?");
  });

  it("returns question string from SELECT_EFFECTYN", () => {
    const prompt = decisionPrompt(msg("SELECT_EFFECTYN", { question: "Activate Mirror Force?" }));
    expect(prompt).toBe("Activate Mirror Force?");
  });

  it("returns fallback for unknown message", () => {
    expect(decisionPrompt(msg("MYSTERY_MSG"))).toMatch(/decision/i);
  });
});
