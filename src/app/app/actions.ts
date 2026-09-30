"use server";
// Server actions for the signed-in app. Every state change goes through a SECURITY DEFINER RPC,
// so these are thin: validate input shape, call the RPC as the user, revalidate, report.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ActionForm";
import { ActionError, friendlyError, optStr, rpc, run, str } from "@/lib/actions";
import { authorNameMatches, fetchArxivRecord } from "@/lib/arxiv";
import { getMyProfile, requireProfile } from "@/lib/auth";
import { fetchWorks, searchAuthors, type OpenAlexAuthor } from "@/lib/openalex";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ENDORSEMENT_CODE_RE, EVIDENCE_RE, LINKEDIN_RE, orcidValid, parseArxivId } from "@/lib/validators";

const numList = (fd: FormData, key: string) => fd.getAll(key).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
const strList = (fd: FormData, key: string) => fd.getAll(key).map(String).map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------
export async function saveProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, profile } = await getMyProfile();
  if (!user) redirect("/login");
  const isNew = !profile;
  const result = await run(async () => {
    const linkedin = str(fd, "linkedin_url");
    if (!LINKEDIN_RE.test(linkedin)) throw new ActionError("Use your LinkedIn profile URL, like https://www.linkedin.com/in/your-name");
    const orcid = optStr(fd, "orcid")?.toUpperCase() ?? null;
    if (orcid && !orcidValid(orcid)) throw new ActionError("That ORCID iD is not valid (checksum failed). Format: 0000-0000-0000-0000.");
    const supabase = await createClient();
    await rpc(supabase, "upsert_profile", {
      p_handle: str(fd, "handle").toLowerCase(),
      p_display_name: str(fd, "display_name"),
      p_linkedin_url: linkedin,
      p_category_codes: strList(fd, "categories"),
      p_topic_ids: numList(fd, "topics"),
      p_age_confirmed: fd.get("age_confirmed") === "on",
      p_headline: optStr(fd, "headline"),
      p_bio: optStr(fd, "bio"),
      p_google_scholar_url: optStr(fd, "google_scholar_url"),
      p_orcid: orcid,
      p_homepage_url: optStr(fd, "homepage_url"),
      p_hf_username: optStr(fd, "hf_username"),
    });
    revalidatePath("/app", "layout");
    return "Profile saved.";
  });
  if (isNew && result?.ok) {
    redirect(fd.get("wants_to_endorse") === "on" ? "/app/settings?welcome=1#endorse" : "/app?welcome=1");
  }
  return result;
}

export async function uploadAvatarAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase, user } = await requireProfile();
    const file = fd.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Choose an image.");
    if (file.size > 1024 * 1024) throw new ActionError("Avatars must be 1 MB or smaller.");
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
    if (!ext) throw new ActionError("Use a PNG, JPEG or WebP image.");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (error) throw new ActionError("Upload failed. Please try again.");
    await rpc(supabase, "set_avatar", { p_path: path });
    revalidatePath("/app/settings");
    return "Avatar updated.";
  });
}

export async function setAvailabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const on = fd.get("on") === "true";
    await rpc(supabase, "set_public_availability", { p_on: on });
    revalidatePath("/app/settings");
    return on ? "Your availability page is live. Share it!" : "Your availability page is now hidden.";
  });
}

export async function searchOpenAlexAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireProfile();
    const q = str(fd, "q");
    if (q.length < 3) throw new ActionError("Type at least 3 characters of your name.");
    let authors: OpenAlexAuthor[] = [];
    try {
      authors = await searchAuthors(q);
    } catch {
      throw new ActionError("OpenAlex didn't respond. This is optional; try again later.");
    }
    return { data: authors, ok: authors.length ? undefined : "No matching OpenAlex authors found." };
  });
}

export async function linkOpenAlexAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "author_id");
    if (!/^A\d+$/.test(id)) throw new ActionError("Pick an author record.");
    let works: Awaited<ReturnType<typeof fetchWorks>> = [];
    try {
      works = await fetchWorks(id);
    } catch {
      throw new ActionError("OpenAlex didn't respond. This is optional; try again later.");
    }
    const n = await rpc<number>(supabase, "set_openalex_publications", { p_author_id: id, p_works: works });
    revalidatePath("/app/settings");
    return `Linked. ${n} recent publications listed on your profile.`;
  });
}

export async function unlinkOpenAlexAction(): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "set_openalex_publications", { p_author_id: null, p_works: [] });
    revalidatePath("/app/settings");
    return "OpenAlex unlinked.";
  });
}

// ---------------------------------------------------------------------------
// endorser capabilities
// ---------------------------------------------------------------------------
export async function attestCapabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const evidence = str(fd, "evidence_url");
    if (!EVIDENCE_RE.test(evidence)) throw new ActionError("Paste the arXiv link https://arxiv.org/auth/show-endorsers/<paper id> for one of your papers.");
    if (fd.get("attest") !== "on") throw new ActionError("Please confirm the eligibility statement.");
    await rpc(supabase, "attest_capability", { p_category: str(fd, "category"), p_evidence_url: evidence });
    revalidatePath("/app/settings");
    return "Thanks! You can now accept abstracts in this category.";
  });
}

export async function updateCapabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const until = optStr(fd, "paused_until");
    await rpc(supabase, "update_capability_settings", {
      p_category: str(fd, "category"),
      p_max_active: Number(str(fd, "max_active_reviews")),
      p_accepting: fd.get("accepting") === "on",
      p_paused_until: until ? new Date(until + "T23:59:59Z").toISOString() : null,
    });
    revalidatePath("/app/settings");
    return "Settings saved.";
  });
}

export async function removeCapabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "remove_capability", { p_category: str(fd, "category") });
    revalidatePath("/app/settings");
    return "Removed.";
  });
}

// ---------------------------------------------------------------------------
// papers (author)
// ---------------------------------------------------------------------------
function paperArgs(fd: FormData) {
  return {
    p_title: str(fd, "title"),
    p_abstract: str(fd, "abstract"),
    p_primary_category: str(fd, "primary_category"),
    p_cross_list: strList(fd, "cross_list").filter((c) => c !== str(fd, "primary_category")),
    p_paper_type: str(fd, "paper_type"),
    p_topic_ids: numList(fd, "topics").slice(0, 3),
    p_peer_review_proof_url: optStr(fd, "peer_review_proof_url"),
    p_repo_url: optStr(fd, "repo_url"),
  };
}

function readinessAnswers(fd: FormData) {
  const yes = (k: string) => fd.get(k) === "yes";
  return {
    paper_type: str(fd, "rc_paper_type"),
    english_complete: yes("rc_english_complete"),
    draft_finished: yes("rc_draft_finished"),
    primary_category: str(fd, "rc_primary_category"),
    own_work: yes("rc_own_work"),
    has_endorsement_code: yes("rc_has_endorsement_code"),
    no_mass_asking: yes("rc_no_mass_asking"),
  };
}

/** Creates the draft, runs the readiness check and posts — all three RPCs enforce their own rules. */
export async function createAndPostPaperAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let paperId: string | null = null;
  const result = await run(async () => {
    const { supabase } = await requireProfile();
    paperId = await rpc<string>(supabase, "create_paper_draft", { ...paperArgs(fd), p_own_work: fd.get("own_work") === "on" });
    const check = await rpc<{ passed: boolean; failed_items: string[] }>(supabase, "submit_readiness_check", {
      p_paper: paperId, p_answers: readinessAnswers(fd),
    });
    if (!check.passed) {
      return { error: `Saved as a draft, but the readiness check didn't pass yet (${check.failed_items.join(", ")}). Fix it on the paper page.` };
    }
    await rpc(supabase, "post_abstract", { p_paper: paperId });
    revalidatePath("/app/papers");
  });
  if (paperId) redirect(`/app/papers/${paperId}${result?.error ? "?draft=1" : "?posted=1"}`);
  return result;
}

export async function updateAbstractAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "paper_id");
    await rpc(supabase, "update_abstract", { p_paper: id, ...paperArgs(fd) });
    revalidatePath(`/app/papers/${id}`);
    return "Abstract updated.";
  });
}

export async function readinessAndPostAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "paper_id");
    const check = await rpc<{ passed: boolean; failed_items: string[] }>(supabase, "submit_readiness_check", {
      p_paper: id, p_answers: readinessAnswers(fd),
    });
    if (!check.passed) return { error: `Not ready yet: ${check.failed_items.join(", ")}. See the notes next to each question.` };
    await rpc(supabase, "post_abstract", { p_paper: id });
    revalidatePath(`/app/papers/${id}`);
    return "Your abstract is posted. Endorsers in your category can now see it.";
  });
}

export async function withdrawPaperAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "paper_id");
    await rpc(supabase, "withdraw_paper", { p_paper: id });
    revalidatePath(`/app/papers/${id}`);
    return "Paper withdrawn. Its files will be deleted in 30 days.";
  });
}

export async function addCoauthorAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "paper_id");
    await rpc(supabase, "add_coauthor", { p_paper: id, p_handle: str(fd, "handle").replace(/^@/, "") });
    revalidatePath(`/app/papers/${id}`);
    return "Co-author added.";
  });
}

export async function setCodeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "paper_id");
    const code = str(fd, "code").toUpperCase();
    if (!ENDORSEMENT_CODE_RE.test(code)) throw new ActionError("An arXiv endorsement code is 6 letters or digits.");
    await rpc(supabase, "set_endorsement_code", { p_paper: id, p_code: code });
    revalidatePath(`/app/papers/${id}`);
    return "Endorsement code saved. Reviewers see it only after opening your full paper.";
  });
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export async function uploadVersionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const id = str(fd, "paper_id");
    const file = fd.get("pdf");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Choose a PDF file.");
    if (file.size > 10 * 1024 * 1024) throw new ActionError("PDFs must be 10 MB or smaller.");
    const buf = new Uint8Array(await file.arrayBuffer());
    if (!PDF_MAGIC.every((b, i) => buf[i] === b)) throw new ActionError("That file isn't a PDF.");
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const sha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

    // cheap pre-check so we don't store an orphan file: first upload needs an acceptance
    const [{ count: versions }, { count: acceptances }] = await Promise.all([
      supabase.from("paper_versions").select("id", { count: "exact", head: true }).eq("paper_id", id),
      supabase.from("engagements").select("id", { count: "exact", head: true }).eq("paper_id", id)
        .in("state", ["accepted", "waitlisted", "reviewing", "endorsed_pending_author"]),
    ]);
    if (!versions && !acceptances) throw new ActionError("You can upload the full paper once at least one endorser has accepted your abstract.");

    const path = `${id}/${crypto.randomUUID().replace(/-/g, "")}.pdf`;
    const { error: upErr } = await supabase.storage.from("papers").upload(path, buf, { contentType: "application/pdf" });
    if (upErr) throw new ActionError("Upload failed. Is the paper still open?");
    try {
      await rpc(supabase, "upload_version", { p_paper: id, p_storage_path: path, p_sha256: sha, p_size_bytes: file.size, p_note: optStr(fd, "note") });
    } catch (e) {
      try { await createAdminClient().storage.from("papers").remove([path]); } catch { /* best effort */ }
      throw e;
    }
    revalidatePath(`/app/papers/${id}`);
    return "New version uploaded. Active reviewers were notified.";
  });
}

export async function sharePaperAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const state = await rpc<string>(supabase, "share_paper", { p_engagement: str(fd, "engagement_id") });
    revalidatePath(`/app/papers/${str(fd, "paper_id")}`);
    return state === "reviewing" ? "Shared. The review has started." : "All review slots are busy, so this reviewer is on the waitlist.";
  });
}

export async function releaseReviewerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "release_reviewer", { p_engagement: str(fd, "engagement_id") });
    revalidatePath(`/app/papers/${str(fd, "paper_id")}`);
    return "Reviewer released.";
  });
}

export async function confirmEndorsementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "confirm_endorsement", { p_engagement: str(fd, "engagement_id") });
    revalidatePath(`/app/papers/${str(fd, "paper_id")}`);
    return "Endorsement confirmed. Congratulations!";
  });
}

export async function rateFeedbackAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "rate_feedback", {
      p_engagement: str(fd, "engagement_id"), p_helpful: fd.get("helpful") === "true", p_comment: optStr(fd, "comment"),
    });
    revalidatePath(`/app/papers/${str(fd, "paper_id")}`);
    return "Thanks for rating.";
  });
}

export async function sendNudgeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "send_nudge", { p_paper: str(fd, "paper_id"), p_endorser: str(fd, "endorser_id") });
    revalidatePath(`/app/papers/${str(fd, "paper_id")}`);
    return "Nudge sent (in-app only).";
  });
}

export async function verifyArxivAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, profile } = await requireProfile();
    const paperId = str(fd, "paper_id");
    const id = parseArxivId(str(fd, "arxiv_id"));
    if (!id) throw new ActionError("That doesn't look like an arXiv ID (e.g. 2409.12345).");
    let record;
    try {
      record = await fetchArxivRecord(id);
    } catch {
      throw new ActionError("The arXiv API didn't respond. Please try again in a few minutes.");
    }
    if (!record) throw new ActionError("arXiv has no paper with that ID yet. New submissions appear after they are announced.");
    const matched = authorNameMatches(profile.display_name, record.authors);
    let admin;
    try { admin = createAdminClient(); } catch { throw new ActionError("Verification is not configured on this server."); }
    const { error } = await admin.rpc("verify_arxiv_posting", {
      p_actor: user.id, p_paper: paperId, p_arxiv_id: id, p_arxiv_categories: record.categories, p_author_matched: matched,
    });
    if (error) throw new ActionError(friendlyError(error));
    revalidatePath(`/app/papers/${paperId}`);
    return `Verified: “${record.title}” is posted on arXiv. Your endorser's track record has been updated.`;
  });
}

export async function createPledgeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "create_pledge", {
      p_category: str(fd, "category"), p_topic_ids: numList(fd, "topics"), p_source_paper: optStr(fd, "paper_id"),
    });
    revalidatePath("/app", "layout");
    return "Thank you for pledging! We'll remind you 3 months after your paper is posted.";
  });
}

export async function declinePledgeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "decline_pledge", { p_pledge: str(fd, "pledge_id") });
    revalidatePath("/app/settings");
    return "Pledge withdrawn.";
  });
}

// ---------------------------------------------------------------------------
// reviews (endorser)
// ---------------------------------------------------------------------------
export async function acceptAbstractAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let engagementId: string | null = null;
  const result = await run(async () => {
    const { supabase } = await requireProfile();
    engagementId = await rpc<string>(supabase, "accept_abstract", { p_paper: str(fd, "paper_id") });
  });
  if (engagementId) redirect(`/app/reviews/${engagementId}?accepted=1`);
  return result;
}

export async function passAbstractAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "pass_abstract", { p_paper: str(fd, "paper_id") });
    revalidatePath("/app/feed");
    return "Passed. It won't show in your feed again.";
  });
}

export async function markLinkedinAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "mark_linkedin_checked", { p_engagement: str(fd, "engagement_id") });
    revalidatePath(`/app/reviews/${str(fd, "engagement_id")}`);
    return "Noted.";
  });
}

export async function sendFeedbackAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const e = str(fd, "engagement_id");
    await rpc(supabase, "send_feedback", { p_engagement: e, p_body: str(fd, "body"), p_version: optStr(fd, "version_id") });
    revalidatePath(`/app/reviews/${e}`);
    revalidatePath(`/app/papers/${str(fd, "paper_id")}`);
    return "Sent.";
  });
}

export async function recordEndorsedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const e = str(fd, "engagement_id");
    if (fd.get("confirm") !== "on") throw new ActionError("Please confirm you submitted the endorsement on arXiv.");
    await rpc(supabase, "record_endorsed", { p_engagement: e });
    revalidatePath(`/app/reviews/${e}`);
    return "Recorded. The author has been asked to confirm.";
  });
}

export async function recordDeclinedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const e = str(fd, "engagement_id");
    const reason = [str(fd, "template"), str(fd, "reason")].filter(Boolean).join("\n\n");
    await rpc(supabase, "record_declined", { p_engagement: e, p_reason: reason });
    revalidatePath(`/app/reviews/${e}`);
    return "Declined. Thank you for giving the author an honest answer.";
  });
}

export async function withdrawEngagementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const e = str(fd, "engagement_id");
    await rpc(supabase, "withdraw_engagement", { p_engagement: e });
    revalidatePath(`/app/reviews/${e}`);
    return "You've withdrawn from this review.";
  });
}

// ---------------------------------------------------------------------------
// notifications, reports, sharing
// ---------------------------------------------------------------------------
export async function markAllReadAction(): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    await rpc(supabase, "mark_all_notifications_read");
    revalidatePath("/app", "layout");
    return "All caught up.";
  });
}

export async function reportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase, user } = await requireProfile();
    const type = str(fd, "target_type");
    if (!["profile", "paper", "message"].includes(type)) throw new ActionError("Unknown report target.");
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id, target_type: type, target_id: str(fd, "target_id"), reason: str(fd, "reason"),
    });
    if (error) throw new ActionError(friendlyError(error));
    return "Reported. A moderator will take a look.";
  });
}

export async function logShareClick(network: string, surface: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  await supabase.from("share_clicks").insert({ user_id: data.user?.id ?? null, network, surface: surface.slice(0, 60) });
}

// ---------------------------------------------------------------------------
// moderation
// ---------------------------------------------------------------------------
export async function modAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { supabase } = await requireProfile();
    const op = str(fd, "op");
    switch (op) {
      case "flag": await rpc(supabase, "mod_update_flag", { p_flag: Number(str(fd, "id")), p_status: str(fd, "status") }); break;
      case "report": await rpc(supabase, "mod_update_report", { p_report: Number(str(fd, "id")), p_status: str(fd, "status") }); break;
      case "removed": await rpc(supabase, "mod_set_endorsement_removed", { p_endorsement: str(fd, "id"), p_removed: str(fd, "removed") === "true" }); break;
      case "capability": await rpc(supabase, "mod_set_capability_status", { p_user: str(fd, "user_id"), p_category: str(fd, "category"), p_status: str(fd, "status") }); break;
      case "config": {
        let value: unknown;
        try { value = JSON.parse(str(fd, "value")); } catch { throw new ActionError("Value must be valid JSON (e.g. 3, true)."); }
        await rpc(supabase, "mod_set_config", { p_key: str(fd, "key"), p_value: value });
        break;
      }
      default: throw new ActionError("Unknown operation.");
    }
    revalidatePath("/app/admin");
    return "Done.";
  });
}
