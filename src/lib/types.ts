export type Profile = {
  id: string; handle: string; display_name: string; headline: string | null; bio: string | null; avatar_path: string | null;
  linkedin_url: string; google_scholar_url: string | null; orcid: string | null; openalex_author_id: string | null;
  github_username: string | null; hf_username: string | null; homepage_url: string | null; role: "user" | "moderator";
  karma: number; public_availability: boolean; created_at: string;
};

export type Capability = {
  user_id: string; category_code: string; status: "claimed" | "confirmed" | "suspended"; evidence_url: string;
  attested_at: string; confirmed_at: string | null; max_active_reviews: number; accepting: boolean; paused_until: string | null;
};

export type Paper = {
  id: string; owner_id: string; title: string; abstract: string; primary_category: string; cross_list_categories: string[];
  paper_type: string; peer_review_proof_url: string | null; repo_url: string | null; status: string; posted_at: string | null;
  endorsed_at: string | null; arxiv_id: string | null; arxiv_verified_at: string | null; closed_at: string | null;
  created_at: string; updated_at: string;
};

export type Engagement = {
  id: string; paper_id: string; endorser_id: string; state: string; waitlist_reason: string | null; waitlisted_at: string | null;
  accepted_at: string; shared_at: string | null; reviewing_since: string | null; paper_opened_at: string | null;
  paper_opened_version: string | null; linkedin_checked_at: string | null; feedback_rounds: number; last_activity_at: string;
  decided_at: string | null; decline_reason: string | null; closed_at: string | null;
};

export type PaperVersion = {
  id: string; paper_id: string; version_no: number; storage_path: string | null; sha256: string; size_bytes: number;
  note: string | null; uploaded_at: string; deleted_at: string | null;
};

export type FeedbackMessage = {
  id: string; engagement_id: string; sender_id: string; round: number; body: string; paper_version_id: string | null; created_at: string;
};

export type Category = { code: string; archive: string; name: string };
export type Topic = { id: number; category_code: string; slug: string; name: string };
