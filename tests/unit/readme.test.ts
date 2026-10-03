import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BECOME_ENDORSER_FAQ, FIND_ENDORSER_FAQ } from "@/lib/faq";

// The README FAQ is generated from the same source as the home page; run `npm run readme:faq` if this fails.
describe("README FAQ", () => {
  const readme = readFileSync("README.md", "utf8");
  it.each([...FIND_ENDORSER_FAQ, ...BECOME_ENDORSER_FAQ])("includes “$q”", (f) => {
    expect(readme).toContain(`<summary>${f.q}</summary>`);
    expect(readme).toContain(f.a);
  });
});
