export type ShareInput = { url: string; name: string; categories: string[]; openSlots: number };

export function availabilityCopy({ url, categories, openSlots }: ShareInput) {
  const cats = categories.length ? categories.join(", ") : "my field";
  const slots = openSlots === 1 ? "1 review slot" : `${openSlots} review slots`;
  const linkedin =
    `I'm volunteering to give pre-submission feedback to first-time researchers in ${cats} on ResearchGuild — ` +
    `a free, open-source community for people preparing their first preprint. ` +
    `I have ${slots} open right now. If you have a real contribution and need honest feedback (and, if it's ready, an arXiv endorsement), post your abstract here:\n\n${url}\n\n` +
    `#OpenScience #FirstPaper #Research`;
  const x = `Reviewing & endorsing in ${cats} · ${slots} open. First-time researchers: post your abstract on ResearchGuild (free, open source).`;
  return { linkedin, x };
}

export function linkedinShareUrl(url: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function xShareUrl(text: string, url: string) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
