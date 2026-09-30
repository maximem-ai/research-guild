"use client";
import { useActionState } from "react";
import { linkOpenAlexAction, searchOpenAlexAction } from "@/app/app/actions";
import type { OpenAlexAuthor } from "@/lib/openalex";
import { SubmitButton, type ActionState } from "./ActionForm";

export function OpenAlexFinder({ defaultName }: { defaultName: string }) {
  const [search, searchAction] = useActionState(searchOpenAlexAction, null as ActionState);
  const [link, linkAction] = useActionState(linkOpenAlexAction, null as ActionState);
  const authors = (search?.data as OpenAlexAuthor[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <form action={searchAction} className="flex gap-2">
        <label htmlFor="oa-q" className="sr-only">Your name</label>
        <input id="oa-q" name="q" className="input" defaultValue={defaultName} placeholder="Your name as it appears on papers" />
        <SubmitButton className="btn">Find my papers</SubmitButton>
      </form>
      {search?.error && <p className="alert alert-error">{search.error}</p>}
      {search?.ok && <p className="alert">{search.ok}</p>}
      {authors.length > 0 && (
        <form action={linkAction} className="space-y-2">
          <p className="text-sm">Pick your record:</p>
          {authors.map((a) => (
            <label key={a.id} className="flex items-start gap-2 text-sm">
              <input type="radio" name="author_id" value={a.id} className="mt-1" required />
              <span><strong>{a.name}</strong>{a.hint ? ` — ${a.hint}` : ""}{a.works != null ? ` · ${a.works} works` : ""} <span className="muted">({a.id})</span></span>
            </label>
          ))}
          <SubmitButton className="btn btn-primary btn-sm">Use this record</SubmitButton>
        </form>
      )}
      {link?.error && <p className="alert alert-error">{link.error}</p>}
      {link?.ok && <p className="alert alert-ok">{link.ok}</p>}
    </div>
  );
}
