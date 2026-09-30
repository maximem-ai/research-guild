import { describe, expect, it } from "vitest";
import { notificationHref, notificationText } from "@/lib/notifications";
import { availabilityCopy, linkedinShareUrl, xShareUrl } from "@/lib/share";

describe("share copy", () => {
  const c = availabilityCopy({ url: "https://x.test/e/ada", name: "Ada", categories: ["cs.AI"], openSlots: 2 });
  it("fits X and mentions category + slots", () => {
    expect(c.x).toContain("cs.AI");
    expect(c.x).toContain("2 review slots");
    expect(c.x.length + 24).toBeLessThanOrEqual(280);
    expect(c.linkedin).toContain("https://x.test/e/ada");
  });
  it("builds prefilled share URLs", () => {
    expect(linkedinShareUrl("https://x.test/e/ada")).toBe("https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fx.test%2Fe%2Fada");
    expect(xShareUrl("hi there", "https://x.test")).toBe("https://twitter.com/intent/tweet?text=hi%20there&url=https%3A%2F%2Fx.test");
  });
});

describe("notifications", () => {
  it("routes to the reviewer view for my engagements, else the paper", () => {
    const n = { type: "feedback", payload: { paper_id: "p1", engagement_id: "e1" } };
    expect(notificationHref(n, new Set(["e1"]))).toBe("/app/reviews/e1");
    expect(notificationHref(n, new Set())).toBe("/app/papers/p1");
    expect(notificationHref({ type: "nudge", payload: { paper_id: "p1" } }, new Set())).toBe("/app/feed");
  });
  it("has text for every notification type raised in SQL", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const sql = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    const types = new Set([...sql.matchAll(/notify_(?:user|paper_members)\([^,]+,\s*'([a-z_]+)'/g)].map((m) => m[1]));
    expect(types.size).toBeGreaterThan(15);
    for (const t of types) expect(notificationText({ type: t, payload: {} })).not.toBe(t.replace(/_/g, " "));
  });
});
