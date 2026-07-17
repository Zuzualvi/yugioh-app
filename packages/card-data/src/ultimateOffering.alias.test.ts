/**
 * ENG-ULTIMATE-OFFERING passcode reconciliation tests.
 *
 * Asserts:
 *   - aliasIndex["511003023"] === 80604091  (pre-errata alias → display passcode)
 *   - resolveAlias(511003023) === 80604091
 *   - 80604092 is NOT present in the alias index (stray image filename, not a legal passcode)
 *   - Ancient Fairy Dragon: aliasIndex["25862691"] === 25862681
 *   - resolveAlias(25862691) === 25862681
 */

import { describe, expect, it } from "vitest";
import { loadAliasIndex, resolveAlias } from "./index.js";

describe("ENG-ULTIMATE-OFFERING — alias reconciliation", () => {
  it("aliasIndex resolves 511003023 to base 80604091", () => {
    const aliasIndex = loadAliasIndex();
    expect(aliasIndex["511003023"]).toBe(80604091);
  });

  it("resolveAlias(511003023) returns 80604091", () => {
    const aliasIndex = loadAliasIndex();
    expect(resolveAlias(511003023, aliasIndex)).toBe(80604091);
  });

  it("80604092 is NOT present in the alias index (stray image filename excluded)", () => {
    const aliasIndex = loadAliasIndex();
    expect(Object.prototype.hasOwnProperty.call(aliasIndex, "80604092")).toBe(false);
  });

  it("Ancient Fairy Dragon: aliasIndex resolves 25862691 to base 25862681", () => {
    const aliasIndex = loadAliasIndex();
    expect(aliasIndex["25862691"]).toBe(25862681);
  });

  it("Ancient Fairy Dragon: resolveAlias(25862691) returns 25862681", () => {
    const aliasIndex = loadAliasIndex();
    expect(resolveAlias(25862691, aliasIndex)).toBe(25862681);
  });
});
