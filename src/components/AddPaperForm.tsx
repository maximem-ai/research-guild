"use client";
import { addPaperAction, removePaperAction } from "@/app/app/actions";
import { ActionForm, SubmitButton } from "./ActionForm";

/** Add a past paper by arXiv ID, arXiv link or DOI; the server looks it up and checks the author list. */
export function AddPaperForm() {
  return (
    <ActionForm action={addPaperAction} resetOnSuccess>
      <div className="flex gap-2">
        <label htmlFor="paper-ref" className="sr-only">arXiv ID, arXiv link or DOI</label>
        <input id="paper-ref" name="ref" className="input" placeholder="2409.12345, arxiv.org/abs/… or 10.1145/…" required />
        <SubmitButton className="btn">Add paper</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RemovePaperButton({ id }: { id: number }) {
  return (
    <ActionForm action={removePaperAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-sm" confirm="Remove this paper from your profile?">Remove</SubmitButton>
    </ActionForm>
  );
}
