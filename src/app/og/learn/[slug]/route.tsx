import { ImageResponse } from "next/og";
import { articles, getArticle } from "@/lib/learn";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  const title = a?.title ?? "Learning center";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 72, background: "#fbfaf7", color: "#1c1b19", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontSize: 28, color: "#1f6f69" }}>Endorse Commons · Learning center</div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 54 : 66, lineHeight: 1.15, fontWeight: 700 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 24, color: "#5d5a54" }}>Free answers for first-time researchers · no sign-in</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
