import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const assets = readdirSync("dist/assets")
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => "/assets/" + f);
const hash = createHash("sha256")
  .update(assets.join(",") + readFileSync("public/sw.js"))
  .digest("hex")
  .slice(0, 12);
const source = readFileSync("public/sw.js", "utf8")
  .replace(
    /const CACHE = .*?;/,
    `const CACHE = ${JSON.stringify("jam-manager-" + hash)};`,
  )
  .replace(
    /const PRECACHE = [\s\S]*?;/,
    `const PRECACHE = ${JSON.stringify(["/", "/icon.svg", "/manifest.webmanifest", "/config.js", ...assets])};`,
  );
writeFileSync("dist/sw.js", source);
console.log(
  `PWA precache: ${assets.length} production assets, revision ${hash}`,
);
