import { describe, expect, it } from "vitest";
import { EVIDENCE_RE, HANDLE_RE, LINKEDIN_RE, orcidValid, parseArxivId, suggestHandle } from "@/lib/validators";

describe("LinkedIn URL", () => {
  it.each([
    ["https://www.linkedin.com/in/ada-lovelace", true],
    ["https://linkedin.com/in/ada_lovelace/", true],
    ["https://www.linkedin.com/in/%C3%A9lise", true],
    ["http://www.linkedin.com/in/ada", false],
    ["https://www.linkedin.com/company/acme", false],
    ["https://evil.com/linkedin.com/in/ada", false],
  ])("%s -> %s", (url, ok) => expect(LINKEDIN_RE.test(url)).toBe(ok));
});

describe("ORCID checksum", () => {
  it("accepts valid iDs (incl. X check digit)", () => {
    expect(orcidValid("0000-0002-1825-0097")).toBe(true);
    expect(orcidValid("0000-0002-9079-593X")).toBe(true);
  });
  it("rejects bad checksum or format", () => {
    expect(orcidValid("0000-0002-1825-0098")).toBe(false);
    expect(orcidValid("0000000218250097")).toBe(false);
  });
});

describe("arXiv id parsing", () => {
  it.each([
    ["2409.12345", "2409.12345"],
    ["arXiv:2409.12345v3", "2409.12345"],
    ["https://arxiv.org/abs/2409.12345v2", "2409.12345"],
    ["https://arxiv.org/pdf/2409.1234.pdf", "2409.1234"],
    ["hep-th/9901001", "hep-th/9901001"],
    ["math.GT/0309136", "math.GT/0309136"],
    ["not an id", null],
  ])("%s -> %s", (input, out) => expect(parseArxivId(input)).toBe(out));
});

describe("misc", () => {
  it("evidence link must be arXiv show-endorsers", () => {
    expect(EVIDENCE_RE.test("https://arxiv.org/auth/show-endorsers/2401.00001")).toBe(true);
    expect(EVIDENCE_RE.test("https://arxiv.org/abs/2401.00001")).toBe(false);
  });
  it("suggests valid handles", () => {
    for (const n of ["Ada Lovelace", "Élise Durand-Ngũgĩ", "", "Li"]) expect(HANDLE_RE.test(suggestHandle(n))).toBe(true);
  });
});
