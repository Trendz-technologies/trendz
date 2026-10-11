/**
 * Writes src/lib/phone-metadata.in.json: the phone numbering rules for India
 * only, cut from the full set that ships with libphonenumber-js.
 *
 *   npm run phone:metadata
 *
 * Every phone field in the application is fixed to India (see
 * src/components/ui/phone-input.tsx), so the rules for the other 240 countries
 * (about 150 KB) are left out of the pages. Run this again after upgrading
 * react-phone-number-input, so the rules follow the library.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// libphonenumber-js is react-phone-number-input's own dependency, so it is looked up from there.
const library = createRequire(createRequire(import.meta.url).resolve("react-phone-number-input/package.json"));
const all = library("libphonenumber-js/metadata.max.json");

const india = { version: all.version, country_calling_codes: { 91: ["IN"] }, countries: { IN: all.countries.IN }, nonGeographic: {} };
const out = join(here, "..", "src", "lib", "phone-metadata.in.json");
writeFileSync(out, `${JSON.stringify(india)}\n`);
console.log(`Wrote ${out} (libphonenumber-js ${library("libphonenumber-js/package.json").version}, ${JSON.stringify(india).length} bytes)`);
