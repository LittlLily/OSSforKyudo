"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  HiOutlineAtSymbol,
  HiOutlineIdentification,
  HiOutlineKey,
  HiOutlineShieldCheck,
  HiOutlineUserPlus,
} from "react-icons/hi2";
import { createUser } from "@/app/actions/admin";

type AdminCreateState = { message: string };

const initialState: AdminCreateState = { message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-primary"
      type="submit"
      disabled={pending}
    >
      <span className="inline-flex items-center gap-2">
        <HiOutlineUserPlus className="text-base" />
        {pending ? "Creating..." : "Create"}
      </span>
    </button>
  );
}

export default function AdminCreateUserForm() {
  const [state, formAction] = useActionState(createUser, initialState);

  return (
    <form className="card space-y-4" action={formAction}>
      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineAtSymbol className="text-base" />
          Email
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
          Password
        </span>
        <input
          className="w-full"
          type="password"
          name="password"
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineIdentification className="text-base" />
          Name (日本語)
        </span>
        <input
          className="w-full"
          name="display_name"
        />
      </label>
      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineShieldCheck className="text-base" />
          Role
        </span>
        <select className="w-full" name="role">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <div className="inline-list">
        <SubmitButton />
      </div>
      {state.message ? (
        <p className="mt-2 text-sm whitespace-pre-wrap">{state.message}</p>
      ) : null}
    </form>
  );
}
