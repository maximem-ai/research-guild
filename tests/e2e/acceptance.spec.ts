import { expect, test } from "@playwright/test";
import { admin, createUser, hasSupabase, makeProfile, postPaper, randomCode, rpc, setConfig, uploadPdf } from "./helpers";

test.skip(!hasSupabase, "needs a local Supabase");

// SPEC §16: author + 3 endorsers: accept → share (3rd reviewer waitlisted) → feedback ×2 → endorse → others notified.
// The checklist's "3rd reviewer waitlisted" implies two active slots, so the scenario runs with max 2 (restored after).
test("multi-endorser acceptance scenario against the real stack", async () => {
  await setConfig("max_active_reviewers_per_paper", 2);
  try {
    const author = await createUser("acc_author");
    await makeProfile(author, "Mary Somerville");
    const r = await Promise.all(["acc_r1", "acc_r2", "acc_r3"].map((h) => createUser(h)));
    for (const [i, u] of r.entries()) await makeProfile(u, `Reviewer ${i + 1}`, ["cs.AI"]);
    const paperId = await postPaper(author, "An acceptance scenario for the commons");

    const e = [];
    for (const u of r) e.push(await rpc<string>(u.client, "accept_abstract", { p_paper: paperId }));
    const vid = await uploadPdf(author, paperId);
    await rpc(author.client, "set_endorsement_code", { p_paper: paperId, p_code: randomCode() });
    const states = [];
    for (const id of e) states.push(await rpc<string>(author.client, "share_paper", { p_engagement: id }));
    expect(states).toEqual(["reviewing", "reviewing", "waitlisted"]);

    // feedback ×2
    await rpc(r[0].client, "log_paper_open", { p_engagement: e[0], p_version: vid });
    await rpc(r[0].client, "send_feedback", { p_engagement: e[0], p_body: "Round 1" });
    await rpc(author.client, "send_feedback", { p_engagement: e[0], p_body: "Updated" });
    await rpc(r[0].client, "send_feedback", { p_engagement: e[0], p_body: "Round 2" });
    const { data: eng } = await r[0].client.from("engagements").select("feedback_rounds").eq("id", e[0]).single();
    expect(eng!.feedback_rounds).toBe(2);

    // code hidden from reviewer 2 until they open the paper
    const { data: hidden } = await r[1].client.from("paper_secrets").select("endorsement_code").eq("paper_id", paperId);
    expect(hidden).toEqual([]);
    // stranger can't read the version or the thread
    const { data: sv } = await r[2].client.from("paper_versions").select("id").eq("paper_id", paperId);
    expect(sv).toEqual([]);

    await rpc(r[0].client, "mark_linkedin_checked", { p_engagement: e[0] });
    await rpc(r[0].client, "record_endorsed", { p_engagement: e[0] });
    await rpc(author.client, "confirm_endorsement", { p_engagement: e[0] });

    const { data: all } = await admin().from("engagements").select("id, state").eq("paper_id", paperId);
    const byId = Object.fromEntries((all ?? []).map((x) => [x.id, x.state]));
    expect(byId[e[0]]).toBe("endorsed");
    expect(byId[e[1]]).toBe("closed_endorsed_elsewhere");
    expect(byId[e[2]]).toBe("closed_endorsed_elsewhere");
    for (const u of [r[1], r[2]]) {
      const { data: n } = await u.client.from("notifications").select("type").eq("type", "endorsed_elsewhere");
      expect(n?.length).toBe(1);
    }
  } finally {
    await setConfig("max_active_reviewers_per_paper", 3);
  }
});
