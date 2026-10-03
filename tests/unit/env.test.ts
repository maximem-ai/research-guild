import { describe, expect, it } from "vitest";
import { normalizeSiteUrl } from "@/lib/env";

describe("normalizeSiteUrl", () => {
  it("adds https:// when the build variable has no scheme", () => {
    expect(normalizeSiteUrl("researchguild.org")).toBe("https://researchguild.org");
  });
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeSiteUrl("  https://researchguild.org/ ")).toBe("https://researchguild.org");
  });
  it("keeps http for local development and falls back when unset", () => {
    expect(normalizeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeSiteUrl(undefined)).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("")).toBe("http://localhost:3000");
  });
  it("always yields something new URL() accepts", () => {
    for (const v of ["researchguild.org", "www.researchguild.org/", " https://researchguild.org "]) {
      expect(() => new URL(normalizeSiteUrl(v))).not.toThrow();
    }
  });
});
