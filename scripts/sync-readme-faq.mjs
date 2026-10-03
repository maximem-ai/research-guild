// Writes the home-page FAQs (src/lib/faq.ts) into README.md between the faq:start / faq:end markers,
// so the README and researchguild.org always say the same thing. tests/unit/readme.test.ts checks it.
// Usage: npm run readme:faq   (Node 22.18+ strips the TypeScript types on import)
import { readFileSync, writeFileSync } from "node:fs";
import { BECOME_ENDORSER_FAQ, FIND_ENDORSER_FAQ } from "../src/lib/faq.ts";

export function faqMarkdown() {
  const block = (title, items) => [
    `**${title}**`, "",
    ...items.map((f) => `<details><summary>${f.q}</summary>\n\n${f.a}\n\n</details>`),
    "",
  ].join("\n");
  return [block("Finding an endorser", FIND_ENDORSER_FAQ), block("Becoming an endorser", BECOME_ENDORSER_FAQ)].join("\n");
}

const START = /<!-- faq:start[^>]*-->/;
const END = "<!-- faq:end -->";
const readme = readFileSync("README.md", "utf8");
const m = readme.match(START);
if (!m) throw new Error("README.md has no faq:start marker");
const before = readme.slice(0, m.index + m[0].length);
const after = readme.slice(readme.indexOf(END));
writeFileSync("README.md", `${before}\n${faqMarkdown()}\n${after}`);
console.log("README FAQ synced");
