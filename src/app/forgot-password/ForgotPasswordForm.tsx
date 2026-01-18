"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineEnvelope, HiOutlinePaperAirplane } from "react-icons/hi2";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      setMessage("エラー: メールアドレスは必須です");
      return;
    }

    setPending(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setPending(false);

    if (error) {
      setMessage(`エラー: ${error.message}`);
      return;
    }

    setMessage(
      "パスワード再設定メールを送信しました。届かない場合は迷惑メールも確認してください。"
    );
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineEnvelope className="text-base" />
          メールアドレス
        </span>
        <input className="w-full" name="email" autoComplete="email" />
      </label>

      <div className="inline-list">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          <span className="inline-flex items-center gap-2">
            <HiOutlinePaperAirplane className="text-base" />
            {pending ? "送信中..." : "再設定メールを送る"}
          </span>
        </button>
        <Link className="btn btn-ghost" href="/login">
          ログインに戻る
        </Link>
      </div>

      {message ? (
        <p className="mt-4 text-sm whitespace-pre-wrap">{message}</p>
      ) : null}
    </form>
  );
}
