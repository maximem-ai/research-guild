export type NotificationRow = { id: number; type: string; payload: Record<string, unknown>; read_at: string | null; created_at: string };

const TEXT: Record<string, string> = {
  abstract_accepted: "An endorser accepted your abstract. Upload the full paper and share it with them.",
  paper_shared: "An author shared their full paper with you. Your review has started.",
  waitlisted: "You're on the waitlist for a paper. You'll be moved in automatically when a slot frees.",
  waitlist_promoted: "A review slot opened: a waitlisted review is now active.",
  feedback: "New message in a feedback thread.",
  feedback_rated: "The author rated your feedback.",
  endorsement_recorded: "A reviewer says they endorsed your paper on arXiv. Please confirm.",
  endorsement_confirmed: "The author confirmed your endorsement. Thank you!",
  endorsed_elsewhere: "Another reviewer endorsed a paper you were on. Your review is closed; karma earned is kept.",
  declined: "A reviewer declined to endorse. Read their reason in the thread.",
  released: "The author released you from a review.",
  reviewer_withdrew: "A reviewer withdrew from your paper.",
  paper_withdrawn: "The author withdrew a paper you were engaged with.",
  new_version: "The author uploaded a new version of the paper.",
  expiring_soon: "A review is about to expire. Act soon to keep it open.",
  expired: "A review expired.",
  nudge: "An author thinks your expertise fits their abstract.",
  badge: "You earned a new badge!",
  add_arxiv_id: "Once your paper is announced, add its arXiv ID to verify the posting.",
  endorsed_paper_posted: "A paper you endorsed is now posted on arXiv.",
  pledge_reminder: "It's been 3 months since your paper was posted. Check on arXiv whether you can endorse, and if so, pay it forward.",
  coauthor_added: "You were added as a co-author on a paper.",
  endorsement_removed: "A moderator marked an endorsement of yours as removed/reclassified.",
};

export function notificationText(n: Pick<NotificationRow, "type" | "payload">) {
  if (n.type === "badge") return `You earned the “${String(n.payload.badge ?? "")}” badge!`;
  return TEXT[n.type] ?? n.type.replace(/_/g, " ");
}

/** Links a notification to the reviewer view when the engagement is mine, else to the author view. */
export function notificationHref(n: Pick<NotificationRow, "type" | "payload">, myEngagements: Set<string>) {
  const p = n.payload as { paper_id?: string; engagement_id?: string };
  if (n.type === "nudge") return "/app/feed";
  if (n.type === "pledge_reminder") return "/app/settings#endorse";
  if (n.type === "badge") return "/app/settings";
  if (p.engagement_id && myEngagements.has(p.engagement_id)) return `/app/reviews/${p.engagement_id}`;
  if (p.paper_id) return `/app/papers/${p.paper_id}`;
  return "/app";
}
