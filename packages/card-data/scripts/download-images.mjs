/**
 * download-images.mjs
 *
 * Downloads card images from YGOPRODeck into packages/card-data/images/.
 * Images are named <imageId>.jpg per the spec.
 *
 * Usage:
 *   node scripts/download-images.mjs --sample    # ~30 cards (safe to run now)
 *   node scripts/download-images.mjs             # full pull (~3681 cards, ~500 MB)
 *
 * Respects the YGOPRODeck rate limit of 20 req/s with a 60 ms delay between
 * requests (≈16 req/s). Images are self-hosted — never hotlinked at runtime.
 * Skips already-downloaded files (idempotent).
 *
 * Image naming: <imageId>.jpg  (imageId == passcode for catalog cards;
 * use alias-index.json to map alias passcodes to their imageId before fetching).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");
const IMAGES_DIR = path.join(ROOT, "images");

const YGOP_IMAGE_BASE =
  "https://images.ygoprodeck.com/images/cards/";
const RATE_LIMIT_DELAY_MS = 60; // ~16 req/s (under the 20 req/s cap)
const SAMPLE_SIZE = 30;

const isSample = process.argv.includes("--sample");

// ---------------------------------------------------------------------------
// Load catalog
// ---------------------------------------------------------------------------
const catalog = JSON.parse(
  fs.readFileSync(path.join(OUT, "edison-card-catalog.json"), "utf8"),
);

// ---------------------------------------------------------------------------
// Decide which cards to fetch
// ---------------------------------------------------------------------------
// imageId == passcode for all catalog cards; collect unique imageIds
const allImageIds = [...new Set(catalog.cards.map((c) => c.imageId))];
const imageIds = isSample
  ? allImageIds.slice(0, SAMPLE_SIZE)
  : allImageIds;

console.log(
  `Downloading ${imageIds.length} images${isSample ? " (sample)" : ""} → ${IMAGES_DIR}`,
);
console.log(`Rate limit: one request every ${RATE_LIMIT_DELAY_MS} ms`);

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------
async function downloadImage(imageId) {
  const dest = path.join(IMAGES_DIR, `${imageId}.jpg`);
  if (fs.existsSync(dest)) {
    return { imageId, status: "skipped" };
  }

  const url = `${YGOP_IMAGE_BASE}${imageId}.jpg`;
  let resp;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": "yugioh-app-image-fetcher/1.0" },
    });
  } catch (err) {
    return { imageId, status: "error", detail: String(err) };
  }

  if (!resp.ok) {
    return { imageId, status: "error", detail: `HTTP ${resp.status}` };
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { imageId, status: "downloaded", bytes: buf.length };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i];
    const result = await downloadImage(imageId);

    if (result.status === "downloaded") {
      downloaded++;
      if (downloaded % 10 === 0 || i === imageIds.length - 1) {
        console.log(
          `  [${i + 1}/${imageIds.length}] downloaded ${imageId}.jpg (${result.bytes} bytes)`,
        );
      }
    } else if (result.status === "skipped") {
      skipped++;
    } else {
      errors++;
      console.warn(`  ERROR ${imageId}: ${result.detail}`);
    }

    // Rate-limit delay (skip after last item)
    if (i < imageIds.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  console.log(
    `\nDone: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`,
  );
  console.log(`Images directory: ${IMAGES_DIR}`);
  console.log("Image naming: <imageId>.jpg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
