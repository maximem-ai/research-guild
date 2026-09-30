import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens a full-paper version via a 5-minute signed URL.
// Reviewers go through log_paper_open (records paper_opened_at, which unlocks endorsement);
// members of the paper get a signed URL directly. Storage RLS applies to both.
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const engagementId = request.nextUrl.searchParams.get("engagement");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.nextUrl.origin));

  let path: string | null = null;
  if (engagementId) {
    const { data, error } = await supabase.rpc("log_paper_open", { p_engagement: engagementId, p_version: versionId });
    if (error) return new NextResponse(error.message, { status: 403 });
    path = data as string;
  } else {
    const { data } = await supabase.from("paper_versions").select("storage_path, paper_id").eq("id", versionId).maybeSingle();
    if (!data?.storage_path) return new NextResponse("Not found or no longer available.", { status: 404 });
    const { data: member } = await supabase.rpc("is_paper_member", { p_paper: data.paper_id, p_uid: auth.user.id });
    if (!member) return new NextResponse("Open this paper from your review page.", { status: 403 });
    path = data.storage_path;
  }
  const { data: signed, error } = await supabase.storage.from("papers").createSignedUrl(path!, 300);
  if (error || !signed) return new NextResponse("Could not create a download link.", { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
