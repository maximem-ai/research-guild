// arXiv readiness check (SPEC §13b.B). Item ids mirror public.evaluate_readiness() in SQL,
// which is the authority; this copy powers the public, sign-in-free /learn/readiness-check page.

export type PaperTypeValue = "original_research" | "survey_review" | "position" | "other";

export type ReadinessAnswers = {
  paper_type?: PaperTypeValue;
  peer_review_proof?: boolean; // public page only: "has it passed peer review?"
  english_complete?: boolean;
  draft_finished?: boolean;
  primary_category?: string;
  own_work?: boolean;
  has_endorsement_code?: boolean;
  no_mass_asking?: boolean;
};

export type ReadinessItem = {
  id: "paper_type" | "english_complete" | "draft_finished" | "primary_category" | "own_work" | "has_endorsement_code" | "no_mass_asking";
  question: string;
  failReason: string;
  article: string;
  blocking: boolean;
};

export const READINESS_ITEMS: ReadinessItem[] = [
  { id: "paper_type", question: "What kind of paper is it?", blocking: true,
    failReason: "arXiv CS only accepts review/survey and position papers that have already passed peer review; you'll need proof (URL or DOI).",
    article: "research-survey-position-papers" },
  { id: "english_complete", question: "Is there a complete English version of the paper?", blocking: true,
    failReason: "arXiv needs a complete English version (translations of the full text may accompany it).",
    article: "english-language-requirement" },
  { id: "draft_finished", question: "Is the draft finished — methods, results, and references to current work?", blocking: true,
    failReason: "Endorsers are asked to check the paper engages with current work in the field. Finish the draft first.",
    article: "is-arxiv-right-for-my-paper" },
  { id: "primary_category", question: "Have you chosen your primary category?", blocking: true,
    failReason: "Pick the category that best fits your main contribution; the endorsement is for that category.",
    article: "choosing-primary-category" },
  { id: "own_work", question: "Are you an author of this paper, submitting it yourself?", blocking: true,
    failReason: "Only authors can post their own work here.",
    article: "what-is-arxiv-endorsement" },
  { id: "has_endorsement_code", question: "Do you already have an endorsement code from arXiv for this category?", blocking: false,
    failReason: "Not a blocker: you can post now, but you'll need the code before sharing your full paper.",
    article: "getting-your-endorsement-code" },
  { id: "no_mass_asking", question: "Will you avoid mass-asking endorsers elsewhere while this is open?", blocking: true,
    failReason: "arXiv asks authors not to mass-email potential endorsers. Keep it to the people reviewing here.",
    article: "finding-an-endorser" },
];

export function evaluateReadiness(a: ReadinessAnswers, paper?: { paper_type: string; primary_category: string; peer_review_proof_url: string | null }) {
  const failed: ReadinessItem["id"][] = [];
  const cat = paper?.primary_category ?? a.primary_category ?? "";
  const type = a.paper_type;
  const needsProof = cat.startsWith("cs.") && (type === "survey_review" || type === "position");
  const hasProof = paper ? Boolean(paper.peer_review_proof_url) : Boolean(a.peer_review_proof);
  if (!type || (paper && type !== paper.paper_type) || (needsProof && !hasProof)) failed.push("paper_type");
  if (a.english_complete !== true) failed.push("english_complete");
  if (a.draft_finished !== true) failed.push("draft_finished");
  if (!a.primary_category || (paper && a.primary_category !== paper.primary_category)) failed.push("primary_category");
  if (a.own_work !== true) failed.push("own_work");
  if (a.no_mass_asking !== true) failed.push("no_mass_asking");
  const warnings: ReadinessItem["id"][] = a.has_endorsement_code === true ? [] : ["has_endorsement_code"];
  return { passed: failed.length === 0, failed, warnings };
}
