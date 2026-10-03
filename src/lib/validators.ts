export const LINKEDIN_RE = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?$/;
export const HANDLE_RE = /^[a-z0-9_]{3,30}$/;
export const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
export const EVIDENCE_RE = /^https:\/\/arxiv\.org\/auth\/show-endorsers\//;
export const ENDORSEMENT_CODE_RE = /^[A-Z0-9]{6}$/;
export const HF_USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/;
export const SCHOLAR_RE = /^https:\/\/scholar\.google\.[a-z.]+\//;

/** ISO 7064 11,2 checksum used by ORCID iDs. */
export function orcidValid(orcid: string): boolean {
  if (!ORCID_RE.test(orcid)) return false;
  const digits = orcid.replace(/-/g, "");
  let total = 0;
  for (let i = 0; i < 15; i++) total = (total + Number(digits[i])) * 2;
  const r = (12 - (total % 11)) % 11;
  return (r === 10 ? "X" : String(r)) === digits[15];
}

export { parseArxivId } from "./arxiv";

export function suggestHandle(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (base || "researcher").slice(0, 24).padEnd(3, "_");
}
