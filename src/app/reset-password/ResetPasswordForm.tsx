"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowRightCircle,
  HiOutlineKey,
  HiOutlineLockClosed,
} from "react-icons/hi2";
import { supabase } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "error" | "success";

export default function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    const ensureSession = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        let session = (await supabase.auth.getSession()).data.session;

        if (!session && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            code
          );
          if (error) throw error;
          session = data.session;
        }

        if (!session && accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          session = data.session;
        }

        if (code || accessToken) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          cleanUrl.hash = "";
          window.history.replaceState({}, "", cleanUrl.toString());
        }

        if (!session) {
          throw new Error("無効または期限切れのリンクです。");
        }

        if (!active) return;
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "リンクの検証に失敗しました。"
        );
      }
    };

    ensureSession();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!password || !confirm) {
      setMessage("エラー: パスワードを入力してください。");
      return;
    }

    if (password !== confirm) {
      setMessage("エラー: パスワードが一致しません。");
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setMessage(`エラー: ${error.message}`);
      return;
    }

    setStatus("success");
    setMessage("パスワードを更新しました。ログインしてください。");
  };

  if (status === "checking") {
    return <p className="text-sm">リンクを確認しています...</p>;
  }

  if (status === "error") {
    return (
      <div className="space-y-4 text-sm">
        <p>エラー: {message}</p>
        <div className="inline-list">
          <Link className="btn btn-primary" href="/forgot-password">
            再設定メールを送る
          </Link>
          <Link className="btn btn-ghost" href="/login">
            ログインに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-4 text-sm">
        <p>{message}</p>
        <Link className="btn btn-primary" href="/login">
          ログインへ
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineKey className="text-base" />
          新しいパスワード
        </span>
        <input
          className="w-full"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <HiOutlineLockClosed className="text-base" />
          パスワード（確認）
        </span>
        <input
          className="w-full"
          type="password"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>

      <div className="inline-list">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          <span className="inline-flex items-center gap-2">
            <HiOutlineArrowRightCircle className="text-base" />
            {pending ? "更新中..." : "パスワードを更新"}
          </span>
        </button>
      </div>

      {message ? (
        <p className="mt-4 text-sm whitespace-pre-wrap">{message}</p>
      ) : null}
    </form>
  );
}
