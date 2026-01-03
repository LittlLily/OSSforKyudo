"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/app/actions/auth";

type AuthState = { message: string };

const initialState: AuthState = { message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="border rounded px-4 py-2" type="submit" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block mt-6">
        <span className="text-sm">Email</span>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          name="email"
          autoComplete="email"
        />
      </label>

      <label className="block mt-4">
        <span className="text-sm">Password</span>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          type="password"
          name="password"
          autoComplete="current-password"
        />
      </label>

      <div className="mt-6 flex gap-3">
        <SubmitButton />
      </div>

      {state.message ? (
        <p className="mt-4 text-sm whitespace-pre-wrap">{state.message}</p>
      ) : null}
    </form>
  );
}
