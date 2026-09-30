export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function daysLeft(from: string | null | undefined, ttlDays: number) {
  if (!from) return null;
  const ms = new Date(from).getTime() + ttlDays * 86400_000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}

export const ENGAGEMENT_STATE_LABEL: Record<string, string> = {
  accepted: "Accepted abstract",
  waitlisted: "Waitlisted",
  reviewing: "Reviewing",
  endorsed_pending_author: "Endorsed · awaiting author",
  endorsed: "Endorsed",
  declined: "Declined",
  withdrawn_by_endorser: "Withdrawn by reviewer",
  released_by_author: "Released by author",
  closed_endorsed_elsewhere: "Closed · endorsed by another reviewer",
  expired: "Expired",
};

export const PAPER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  open: "Open for reviewers",
  in_review: "In review",
  endorsed: "Endorsed",
  posted: "Posted on arXiv",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export const PAPER_TYPE_LABEL: Record<string, string> = {
  original_research: "Original research",
  survey_review: "Survey / review",
  position: "Position paper",
  other: "Other",
};

export const BADGE_LABEL: Record<string, string> = {
  first_review: "First review",
  "10_reviews": "10 reviews",
  confirmed_endorser: "Confirmed endorser",
  pay_it_forward: "Pay-it-forward",
};

export const OPEN_STATES = ["accepted", "waitlisted", "reviewing", "endorsed_pending_author"];

export function waitlistText(reason: string | null, position: number | null, maxPerPaper = 3) {
  const pos = position ? ` you're #${position}` : "";
  if (reason === "endorser_full") return `The reviewer is at their review capacity;${pos} in their queue.`;
  return `Paper has ${maxPerPaper} active reviewers;${pos} in line.`;
}
