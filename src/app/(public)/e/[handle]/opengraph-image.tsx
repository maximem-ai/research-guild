import { ImageResponse } from "next/og";
import { getPublicProfile } from "./data";

export const alt = "ResearchGuild availability";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const r = await getPublicProfile(handle);
  const name = r?.profile.display_name ?? "ResearchGuild";
  const cats = r?.profile.capabilities.map((c) => c.category).join(", ") || "open science";
  const slots = r?.profile.open_slots ?? 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 72, background: "#0a0a0a", color: "#f2f2f2", borderTop: "14px solid #ff6a13", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#ff6a13" }}>ResearchGuild</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 44, color: "#a3a3a3" }}>{name}</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.15, marginTop: 16 }}>
            {`I'm reviewing & endorsing in ${cats} · ${slots} slot${slots === 1 ? "" : "s"} open`}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#a3a3a3" }}>Free feedback for first-time researchers · open source</div>
      </div>
    ),
    size,
  );
}
