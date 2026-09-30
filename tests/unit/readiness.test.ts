import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateReadiness, READINESS_ITEMS } from "@/lib/readiness";

const good = { paper_type: "original_research" as const, english_complete: true, draft_finished: true, primary_category: "cs.AI",
  own_work: true, has_endorsement_code: true, no_mass_asking: true };

describe("readiness check", () => {
  it("passes a complete set of answers", () => {
    expect(evaluateReadiness(good)).toEqual({ passed: true, failed: [], warnings: [] });
  });
  it("missing endorsement code is a warning, not a failure", () => {
    const r = evaluateReadiness({ ...good, has_endorsement_code: false });
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual(["has_endorsement_code"]);
  });
  it("CS survey needs peer-review proof", () => {
    expect(evaluateReadiness({ ...good, paper_type: "survey_review" }).failed).toContain("paper_type");
    expect(evaluateReadiness({ ...good, paper_type: "survey_review", peer_review_proof: true }).passed).toBe(true);
    expect(evaluateReadiness({ ...good, paper_type: "position", primary_category: "stat.ML" }).passed).toBe(true);
  });
  it("answers must match the paper when one is given", () => {
    const paper = { paper_type: "original_research", primary_category: "cs.LG", peer_review_proof_url: null };
    expect(evaluateReadiness(good, paper).failed).toEqual(["primary_category"]);
  });
  it("every failing item is reported", () => {
    const r = evaluateReadiness({});
    expect(r.failed).toEqual(["paper_type", "english_complete", "draft_finished", "primary_category", "own_work", "no_mass_asking"]);
  });
  it("item ids match the SQL evaluator", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260930000300_functions.sql"), "utf8");
    const body = sql.slice(sql.indexOf("function evaluate_readiness"), sql.indexOf("function submit_readiness_check"));
    for (const item of READINESS_ITEMS.filter((i) => i.blocking)) expect(body).toContain(`'${item.id}'`);
    expect(READINESS_ITEMS).toHaveLength(7);
  });
});
