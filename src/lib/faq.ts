// Home-page FAQs for the two MVP journeys: finding an endorser, and becoming one.
// Rendered on the home page and emitted as FAQPage JSON-LD, so keep answers plain text.
export type Faq = { q: string; a: string };

export const FIND_ENDORSER_FAQ: Faq[] = [
  {
    q: "How do I find an endorser here?",
    a: "Sign in, pass the 7-question readiness check and post your abstract. Endorsers who listed your arXiv category see it in their feed, and the ones who want to review it accept it. You then share your full paper with them, revise it through feedback rounds, and one of them may endorse you on arXiv's own form when the work is ready.",
  },
  {
    q: "Who can see my abstract and my paper?",
    a: "Only signed-in members can read your abstract, and search engines never index it. Your full paper is a private PDF that you share with reviewers you choose, at most 3 at a time, and the file is deleted 30 days after your paper closes.",
  },
  {
    q: "What if nobody accepts my abstract?",
    a: "Your abstract stays open while you keep improving it. You can nudge endorsers who publish an availability page (up to 3 nudges per paper each week), and the learning center explains other routes to an endorser, such as co-authors and advisors.",
  },
  {
    q: "Is an endorsement guaranteed?",
    a: "No. Endorsers decide on the merits of your full paper, and a decline earns them exactly the same karma as an endorsement, so nobody is rewarded for saying yes. A decline always comes with a reason you can act on.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. ResearchGuild is free and open source under AGPL-3.0; it sends no email and shows no ads.",
  },
  {
    q: "Is ResearchGuild part of arXiv?",
    a: "No. ResearchGuild is independent and not affiliated with arXiv. Endorsements happen on arXiv's own form using your endorsement code, and we never touch arXiv accounts.",
  },
];

export const BECOME_ENDORSER_FAQ: Faq[] = [
  {
    q: "Who can become an endorser?",
    a: "Anyone arXiv already lets endorse in a category. arXiv bases that on papers you authored in the subject area, submitted between three months and five years ago, and on being registered as an author of those papers. ResearchGuild cannot grant eligibility; it helps eligible people find authors who need them.",
  },
  {
    q: "How do I add myself as an endorser?",
    a: "Open Settings, choose a category and paste the arXiv \"show endorsers\" link for one of your papers as evidence (https://arxiv.org/auth/show-endorsers/ followed by the paper ID). Your capability shows as claimed until a paper you endorse here is verified as posted in that category, and then it becomes confirmed.",
  },
  {
    q: "How much time does it take?",
    a: "You set the pace. Choose how many papers you review at once (1 to 10), pause whenever you need to, and accept only the abstracts you want to read. Reviews that go quiet expire, so authors are never left waiting on you indefinitely.",
  },
  {
    q: "Do I have to endorse every paper I review?",
    a: "No. Read the full paper and give feedback, then endorse on arXiv's form if the work is ready or decline with a reason; both earn the same karma. Before you can record an endorsement you must have opened the full paper here and checked the author's LinkedIn profile.",
  },
  {
    q: "What do I get for helping?",
    a: "Karma on per-category leaderboards, badges, and a public track record of the papers you endorsed that went on to be posted on arXiv. You can also publish an availability page with share buttons so that authors in your field can find you.",
  },
  {
    q: "Will my name be public?",
    a: "Only if you turn on your availability page. Otherwise your profile is visible to signed-in members only, and leaderboards show you as \"A community member\".",
  },
];
