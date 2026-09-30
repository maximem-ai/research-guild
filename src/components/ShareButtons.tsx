"use client";
import { useState } from "react";
import { logShareClick } from "@/app/app/actions";
import { linkedinShareUrl, xShareUrl } from "@/lib/share";

export function ShareButtons({ url, linkedinCopy, xCopy, surface }: { url: string; linkedinCopy: string; xCopy: string; surface: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const log = (n: string) => { logShareClick(n, surface).catch(() => {}); };
  const copy = async (text: string, which: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(which); log(which === "LinkedIn" ? "copy_linkedin" : "copy_x"); } catch { setCopied(null); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-sm" href={linkedinShareUrl(url)} target="_blank" rel="noopener noreferrer" onClick={() => log("linkedin")}>Share on LinkedIn</a>
        <a className="btn btn-sm" href={xShareUrl(xCopy, url)} target="_blank" rel="noopener noreferrer" onClick={() => log("x")}>Share on X</a>
        <button type="button" className="btn btn-sm" onClick={() => copy(linkedinCopy, "LinkedIn")}>Copy LinkedIn post</button>
        <button type="button" className="btn btn-sm" onClick={() => copy(`${xCopy} ${url}`, "X")}>Copy X post</button>
      </div>
      {copied && <p className="text-xs muted" role="status">Copied the {copied} draft to your clipboard.</p>}
      <details className="text-sm">
        <summary className="cursor-pointer muted">Preview drafts</summary>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-theme p-3">{linkedinCopy}</p>
        <p className="mt-2 rounded-lg border border-theme p-3">{xCopy} {url}</p>
      </details>
    </div>
  );
}
