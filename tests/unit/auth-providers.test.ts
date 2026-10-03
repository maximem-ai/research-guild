import { describe, expect, it } from "vitest";
import { pickProviders } from "@/lib/auth-providers";

describe("sign-in providers follow Supabase settings", () => {
  it("GitHub only", () => {
    expect(pickProviders({ external: { github: true, google: false, linkedin_oidc: false, email: true } })).toEqual(["github"]);
  });
  it("all three, in display order", () => {
    expect(pickProviders({ external: { linkedin_oidc: true, google: true, github: true } })).toEqual(["github", "google", "linkedin_oidc"]);
  });
  it("ignores providers the app doesn't support (e.g. email) and handles missing settings", () => {
    expect(pickProviders({ external: { email: true, apple: true } })).toEqual([]);
    expect(pickProviders(null)).toEqual([]);
  });
});
