"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/app/actions/auth";

type AuthState = { message: string };

const initialState: AuthState = { message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />

      <label className="field">
        <span className="text-sm font-semibold text-[color:var(--muted)]">
          Email
        </span>
        <input
          className="w-full"
          name="email"
          autoComplete="email"
        />
      </label>

      <label className="field">
        <span className="text-sm font-semibold text-[color:var(--muted)]">
          Password
        </span>
        <input
          className="w-full"
          type="password"
          name="password"
          autoComplete="current-password"
        />
      </label>

      <div className="inline-list">
        <SubmitButton />
      </div>

      {state.message ? (
        <p className="mt-4 text-sm whitespace-pre-wrap">{state.message}</p>
      ) : null}
    </form>
  );
}
