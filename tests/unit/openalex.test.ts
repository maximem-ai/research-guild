import { describe, expect, it } from "vitest";
import { normalizeWork, parseDoi } from "@/lib/openalex";

describe("parseDoi", () => {
  it("accepts bare DOIs, doi: prefixes and doi.org links", () => {
    expect(parseDoi("10.1145/3292500.3330701")).toBe("10.1145/3292500.3330701");
    expect(parseDoi("doi:10.48550/arXiv.2409.12345")).toBe("10.48550/arxiv.2409.12345");
    expect(parseDoi("https://doi.org/10.1000/ABC")).toBe("10.1000/abc");
    expect(parseDoi("https://dx.doi.org/10.1000/xyz")).toBe("10.1000/xyz");
  });
  it("rejects things that aren't DOIs", () => {
    expect(parseDoi("2409.12345")).toBeNull();
    expect(parseDoi("https://arxiv.org/abs/2409.12345")).toBeNull();
    expect(parseDoi("10.12/too-short-prefix")).toBeNull();
  });
});

describe("normalizeWork", () => {
  it("extracts the arXiv id and leaves out the author themself", () => {
    const w = normalizeWork({
      id: "https://openalex.org/W1", title: "A paper", publication_year: 2024, doi: null,
      primary_location: { landing_page_url: "https://arxiv.org/abs/2401.00001v2", source: { display_name: "arXiv" } },
      authorships: [{ author: { id: "https://openalex.org/A1", display_name: "Me" } }, { author: { id: "https://openalex.org/A2", display_name: "Co Author" } }],
    }, "A1");
    expect(w).toMatchObject({ external_id: "W1", arxiv_id: "2401.00001", venue: "arXiv", year: 2024, coauthor_names: ["Co Author"] });
  });
});
