import { afterEach, describe, expect, it, vi } from "vitest";
import { cardImageUrl } from "./cardImageUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cardImageUrl — REQ-DATA-02 self-hosted images", () => {
  describe("production mode (PROD=true)", () => {
    it("returns same-origin /images/<imageId>.jpg", () => {
      vi.stubEnv("PROD", true);
      expect(cardImageUrl(89631139)).toBe("/images/89631139.jpg");
    });

    it("uses imageId field, not passcode", () => {
      vi.stubEnv("PROD", true);
      expect(cardImageUrl(12345678)).toBe("/images/12345678.jpg");
    });

    it("does not contain ygoprodeck in the URL", () => {
      vi.stubEnv("PROD", true);
      expect(cardImageUrl(46986414)).not.toContain("ygoprodeck");
    });
  });

  describe("dev mode (PROD=false)", () => {
    it("falls back to the YGOPRODeck CDN when no VITE_IMAGE_BASE_URL is set", () => {
      vi.stubEnv("PROD", false);
      const url = cardImageUrl(89631139);
      expect(url).toBe("https://images.ygoprodeck.com/images/cards_small/89631139.jpg");
    });

    it("honours VITE_IMAGE_BASE_URL when set", () => {
      vi.stubEnv("PROD", false);
      vi.stubEnv("VITE_IMAGE_BASE_URL", "http://localhost:3000/images/small");
      expect(cardImageUrl(89631139)).toBe("http://localhost:3000/images/small/89631139.jpg");
    });
  });
});
