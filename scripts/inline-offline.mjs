/**
 * Inlines the built JS/CSS into a single self-contained HTML file.
 * Run after: vite build --config vite.offline.config.ts
 * Result: dist-offline/ActionAndQuality-offline.html — share this file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-offline";
let html = readFileSync(join(dir, "index.html"), "utf8");

// Inline module scripts
html = html.replace(
  /<script type="module"[^>]*src="\.?(\/[^"]+)"[^>]*><\/script>/g,
  (_m, src) =>
    `<script type="module">\n${readFileSync(join(dir, src), "utf8")}\n</script>`,
);

// Inline stylesheets
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.?(\/[^"]+)"[^>]*>/g,
  (_m, href) => `<style>\n${readFileSync(join(dir, href), "utf8")}\n</style>`,
);

// Preload links are pointless in a single file — drop them
html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

// Remove the service worker registration: a file:// page has no SW, and
// everything it needs is already inside this file.
html = html.replace(
  /<script>\s*if \("serviceWorker" in navigator[\s\S]*?<\/script>/,
  "",
);

// Anything left pointing at the network means the file is not self-contained.
const leftovers = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
if (leftovers.length) {
  console.error("NOT self-contained, external refs remain:", leftovers);
  process.exit(1);
}

// Drop the manifest link (meaningless on file://), favicon refs fail silently.
html = html.replace(/<link rel="manifest"[^>]*>\s*/g, "");

const out = join(dir, "ActionAndQuality-offline.html");
writeFileSync(out, html);
console.log(`OK: ${out} (${Math.round(html.length / 1024)} KB)`);
