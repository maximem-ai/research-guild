"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { error?: string; ok?: string; data?: unknown } | null;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({ children, className = "btn btn-primary", disabled, confirm }: {
  children: React.ReactNode; className?: string; disabled?: boolean; confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/** A <form> bound to a server action that shows the returned error/success message inline. */
export function ActionForm({ action, children, className, resetOnSuccess, id }: {
  action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; id?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} id={id}>
      {children}
      {state?.error && <p role="alert" className="alert alert-error mt-3">{state.error}</p>}
      {state?.ok && <p role="status" className="alert alert-ok mt-3">{state.ok}</p>}
    </form>
  );
}
