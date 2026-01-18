"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  HiOutlineArrowRightCircle,
  HiOutlineAtSymbol,
  HiOutlineKey,
} from "react-icons/hi2";
import { signIn } from "@/app/actions/auth";

type AuthState = { message: string };

const initialState: AuthState = { message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      <span className="inline-flex items-center gap-2">
        <HiOutlineArrowRightCircle className="text-base" />
        {pending ? "サインイン中..." : "サインイン"}
      </span>
    </button>
  );
}

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />

      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineAtSymbol className="text-base" />
          メールアドレス
        </span>
        <input
          className="w-full"
          name="email"
          autoComplete="email"
        />
      </label>

      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineKey className="text-base" />
          パスワード
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
        <Link className="btn btn-ghost" href="/forgot-password">
          パスワードを忘れた方
        </Link>
      </div>

      {state.message ? (
        <p className="mt-4 text-sm whitespace-pre-wrap">{state.message}</p>
      ) : null}
    </form>
  );
}
