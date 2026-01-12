import { HiOutlineLockClosed, HiOutlineShieldCheck } from "react-icons/hi2";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = typeof params?.next === "string" ? params.next : "/";

  return (
    <main className="page w-full max-w-2xl">
      <div className="space-y-2">
        <p className="section-title flex items-center gap-2">
          <HiOutlineShieldCheck className="text-base" />
          アクセス
        </p>
        <h1 className="page-title flex items-center gap-3">
          <HiOutlineLockClosed className="text-2xl" />
          ログイン
        </h1>
        <p className="page-subtitle">エンタープライズ向けサインインポータル</p>
      </div>
      <div className="card">
        <LoginForm nextPath={nextPath} />
      </div>
      <div className="text-xs text-[color:var(--muted)]">V0.0.0</div>
    </main>
  );
}
