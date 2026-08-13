// Fold dist/ into a single self-contained index.html that opens straight from file://
// (ES module scripts are CORS-blocked on file://, so the bundle is IIFE and inlined).
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assets = readdirSync(join(dist, "assets"));
const js = assets.find((f) => f.endsWith(".js"));
const css = assets.find((f) => f.endsWith(".css")); // absent when Vite inlines CSS into the JS

let html = readFileSync(join(dist, "index.html"), "utf8");
const jsSrc = readFileSync(join(dist, "assets", js), "utf8");
// NOTE: function replacements — a string replacement would interpret `$&`/`$'` in the bundle.
// strip the module tag, then append the bundle at the END of <body> so #root exists
html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, "");
html = html.replace(/<\/body>/, () => `<script>\n${jsSrc}\n</script>\n</body>`);
if (css) {
  const cssSrc = readFileSync(join(dist, "assets", css), "utf8");
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>\n${cssSrc}\n</style>`);
}
writeFileSync(join(dist, "index.html"), html);
rmSync(join(dist, "assets"), { recursive: true, force: true });
console.log("inlined", js, css ?? "(css inlined by vite)");
