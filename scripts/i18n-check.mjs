/**
 * Checks the storefront's Tamil dictionary against the code.
 *
 *   npm run i18n:check
 *
 * Fails when text passed to t() / tn() / tr() / msg() has no Tamil entry, when a
 * translation drops a {placeholder}, or when two dictionary files translate
 * the same sentence differently. Unused entries are listed but do not fail.
 * (The TypeScript build catches missing entries too; this is the quick check.)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const AREAS = ["common", "shop", "checkout", "auth", "account", "reviews"];
const SCAN = ["app", "components/store", "components/ui", "components/require-auth.tsx", "lib/payment.ts", "lib/cms.ts"];
const SKIP = [join("app", "admin"), join("app", "pos")];

const dictionary = new Map();
const problems = [];
for (const area of AREAS) {
  const mod = await import(pathToFileURL(join(src, "lib", "i18n", "ta", `${area}.ts`)).href);
  for (const [key, value] of Object.entries(mod[area])) {
    const seen = dictionary.get(key);
    if (seen && seen.value !== value) problems.push(`"${key}" is translated differently in ${seen.area}.ts and ${area}.ts`);
    if (!seen) dictionary.set(key, { value, area });
    const missing = (key.match(/\{\w+\}/g) ?? []).filter((p) => !value.includes(p));
    if (missing.length) problems.push(`${area}.ts: "${key}" lost ${missing.join(", ")} in its translation`);
  }
}

function* files(path) {
  if (SKIP.some((s) => path.includes(s))) return;
  if (statSync(path).isDirectory()) for (const name of readdirSync(path)) yield* files(join(path, name));
  else if (/\.tsx?$/.test(path)) yield path;
}

const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;
// bilingual() is lib/cms.ts's pairing of a sentence with its Tamil entry.
const single = new RegExp(String.raw`\b(?:t|tr|msg|bilingual)\(\s*${STRING}`, "g");
const plural = new RegExp(String.raw`\btn\([^"]*?,\s*${STRING}\s*,\s*${STRING}`, "g");
const used = new Set();

for (const entry of SCAN) {
  for (const file of files(join(src, entry))) {
    const code = readFileSync(file, "utf8");
    const keys = [...code.matchAll(single)].map((m) => m[1]);
    for (const m of code.matchAll(plural)) keys.push(m[1], m[2]);
    for (const raw of keys) {
      const key = JSON.parse(`"${raw}"`);
      used.add(key);
      if (!dictionary.has(key)) problems.push(`${relative(src, file)}: no Tamil for "${key}"`);
    }
  }
}

const unused = [...dictionary.keys()].filter((k) => !used.has(k));
if (unused.length) console.log(`${unused.length} entries are not referenced by a literal t()/tn()/tr()/msg() call (they may be looked up with tx()):\n  ${unused.join("\n  ")}\n`);

if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n: ${used.size} sentences used, ${dictionary.size} translated — all good.`);
