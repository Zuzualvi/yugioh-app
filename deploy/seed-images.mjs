/**
 * deploy/seed-images.mjs
 *
 * Seeds card images onto the Fly.io persistent volume (/data/images/).
 * Run inside the container after first deploy (see deploy/seed-images.sh).
 *
 * Reuses the same download logic as packages/card-data/scripts/download-images.mjs
 * but writes to /data/images/ (the volume) instead of packages/card-data/images/.
 *
 * Idempotent: skips already-downloaded images.
 * Rate limit: 60ms between requests (≈16 req/s, under the 20 req/s cap).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Catalog is baked into the image at /app/packages/card-data/out/
const CATALOG_PATH = path.join(__dirname, "../packages/card-data/out/edison-card-catalog.json");
// Images go onto the volume
const IMAGES_DIR = process.env["IMAGES_PATH"] ?? "/data/images";

const YGOP_IMAGE_BASE = "https://images.ygoprodeck.com/images/cards/";
const RATE_LIMIT_DELAY_MS = 60; // ≈16 req/s (≤20 req/s cap)

if (!fs.existsSync(CATALOG_PATH)) {
  console.error(`ERROR: Catalog not found at ${CATALOG_PATH}`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
const allImageIds = [...new Set(catalog.cards.map((c) => c.imageId))];

console.log(`Catalog: ${catalog.cards.length} cards, ${allImageIds.length} unique imageIds`);
console.log(`Images directory: ${IMAGES_DIR}`);
console.log(`Rate limit: ${RATE_LIMIT_DELAY_MS}ms between requests`);
console.log("");

fs.mkdirSync(IMAGES_DIR, { recursive: true });

async function downloadImage(imageId) {
  const dest = path.join(IMAGES_DIR, `${imageId}.jpg`);
  if (fs.existsSync(dest)) {
    return { imageId, status: "skipped" };
  }

  const url = `${YGOP_IMAGE_BASE}${imageId}.jpg`;
  let resp;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": "yugioh-app-image-seeder/1.0" },
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

async function main() {
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allImageIds.length; i++) {
    const imageId = allImageIds[i];
    const result = await downloadImage(imageId);

    if (result.status === "downloaded") {
      downloaded++;
      if (downloaded % 50 === 0 || i === allImageIds.length - 1) {
        console.log(
          `  [${i + 1}/${allImageIds.length}] downloaded ${imageId}.jpg (${result.bytes} bytes)`,
        );
      }
    } else if (result.status === "skipped") {
      skipped++;
    } else {
      errors++;
      console.warn(`  ERROR ${imageId}: ${result.detail}`);
    }

    if (i < allImageIds.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`);
  console.log(`Images directory: ${IMAGES_DIR}`);
  if (errors > 0) {
    console.log("Re-run to retry failed images (idempotent).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
