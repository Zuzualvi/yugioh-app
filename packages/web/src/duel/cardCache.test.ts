/**
 * cardCache tests (NH-1 acceptance criteria).
 *
 * - code=0 → get() returns null (hidden card / not entitled)
 * - code=0 → isLoading() returns false
 * - fetch triggered on first get(); null returned while in-flight
 * - isLoading() true while fetching
 * - get() returns CardInfo after fetch resolves
 * - error → get() returns null, isLoading() false
 * - prefetch warms the cache before get() is called
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCardCache } from "./cardCache";
import type { CardDTO } from "@yugioh-app/contracts";

function makeDto(passcode: number): CardDTO {
  return {
    passcode,
    name: `Card ${passcode}`,
    frame: "effect",
    isExtraDeck: false,
    race: "Warrior",
    attribute: "EARTH",
    level: 4,
    atk: 1800,
    def: 1400,
    desc: "Test effect",
    banlist: "unlimited",
    aliasOf: null,
    imageId: passcode,
    preErrataText: false,
  };
}

describe("cardCache (NH-1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for code=0 (not entitled)", () => {
    const cache = createCardCache(() => {}, vi.fn());
    expect(cache.get(0)).toBeNull();
  });

  it("isLoading returns false for code=0", () => {
    const cache = createCardCache(() => {}, vi.fn());
    expect(cache.isLoading(0)).toBe(false);
  });

  it("returns null on first get (triggers fetch) and isLoading becomes true", () => {
    let _resolve: ((v: CardDTO) => void) | null = null;
    const fetchFn = vi.fn().mockReturnValue(
      new Promise<CardDTO>((r) => {
        _resolve = r;
      }),
    );

    const cache = createCardCache(() => {}, fetchFn);
    const result = cache.get(12345);
    expect(result).toBeNull();
    expect(cache.isLoading(12345)).toBe(true);
  });

  it("returns CardInfo after fetch resolves and calls onChange", async () => {
    const dto = makeDto(12345);
    const fetchFn = vi.fn().mockResolvedValue(dto);
    const onChange = vi.fn();
    const cache = createCardCache(onChange, fetchFn);

    // First call triggers fetch.
    cache.get(12345);
    expect(cache.isLoading(12345)).toBe(true);

    // Wait for all promise microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onChange).toHaveBeenCalled();
    const info = cache.get(12345);
    expect(info).not.toBeNull();
    expect(info!.name).toBe("Card 12345");
    expect(cache.isLoading(12345)).toBe(false);
  });

  it("returns null and isLoading false after fetch error", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("not found"));
    const onChange = vi.fn();
    const cache = createCardCache(onChange, fetchFn);

    cache.get(99999);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(cache.get(99999)).toBeNull();
    expect(cache.isLoading(99999)).toBe(false);
  });

  it("does not fetch the same code twice", async () => {
    const dto = makeDto(11111);
    const fetchFn = vi.fn().mockResolvedValue(dto);
    const cache = createCardCache(() => {}, fetchFn);

    cache.get(11111);
    cache.get(11111); // second call
    cache.get(11111); // third call

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // getCard should only be called once.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("prefetch warms the cache before get()", async () => {
    const dto = makeDto(22222);
    dto.name = "Prefetched";
    const fetchFn = vi.fn().mockResolvedValue(dto);
    const cache = createCardCache(() => {}, fetchFn);

    cache.prefetch(22222);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const info = cache.get(22222);
    expect(info?.name).toBe("Prefetched");
    // fetchFn called exactly once (from prefetch, not again from get).
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
