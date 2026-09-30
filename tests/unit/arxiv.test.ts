import { describe, expect, it } from "vitest";
import { authorNameMatches, parseArxivAtom } from "@/lib/arxiv";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2409.12345v2</id>
    <title>A Careful Study of
      Things &amp; Stuff</title>
    <author><name>Ada Lovelace</name></author>
    <author><name>Charles Babbage</name></author>
    <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

const ERROR_FEED = `<feed><entry><id>http://arxiv.org/api/errors#incorrect_id_format_for_1234</id><title>Error</title></entry></feed>`;

describe("parseArxivAtom", () => {
  it("parses id, title, authors and categories", () => {
    const r = parseArxivAtom(FEED)!;
    expect(r.id).toBe("2409.12345");
    expect(r.title).toBe("A Careful Study of Things & Stuff");
    expect(r.authors).toEqual(["Ada Lovelace", "Charles Babbage"]);
    expect(r.categories).toEqual(["cs.AI", "cs.LG"]);
    expect(r.primaryCategory).toBe("cs.AI");
  });
  it("returns null for error entries and empty feeds", () => {
    expect(parseArxivAtom(ERROR_FEED)).toBeNull();
    expect(parseArxivAtom("<feed></feed>")).toBeNull();
  });
});

describe("authorNameMatches", () => {
  const authors = ["Ada Lovelace", "C. Babbage", "Durand-Ngũgĩ, Élise", "José María García"];
  it.each([
    ["Ada Lovelace", true],
    ["A. Lovelace", true],
    ["ada lovelace", true],
    ["Charles Babbage", true],
    ["Elise Durand-Ngugi", true],
    ["Jose Garcia", true],
    ["Grace Lovelace", false],
    ["Ada Byron", false],
    ["", false],
  ])("%s -> %s", (name, ok) => expect(authorNameMatches(name, authors)).toBe(ok));
});
