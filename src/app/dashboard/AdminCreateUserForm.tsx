"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createUser } from "@/app/actions/admin";

type AdminCreateState = { message: string };

const initialState: AdminCreateState = { message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="mt-4 border rounded px-4 py-2"
      type="submit"
      disabled={pending}
    >
      {pending ? "Creating..." : "Create"}
    </button>
  );
}

export default function AdminCreateUserForm() {
  const [state, formAction] = useActionState(createUser, initialState);

  return (
    <form className="mt-8 border rounded p-4" action={formAction}>
      <label className="block mt-4">
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
          autoComplete="new-password"
        />
      </label>
      <label className="block mt-4">
        <span className="text-sm">Name (日本語)</span>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          name="display_name"
        />
      </label>
      <label className="block mt-4">
        <span className="text-sm">Role</span>
        <select className="mt-1 w-full border rounded px-3 py-2" name="role">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <SubmitButton />
      {state.message ? (
        <p className="mt-2 text-sm whitespace-pre-wrap">{state.message}</p>
      ) : null}
    </form>
  );
}
