import { HiOutlineShieldCheck, HiOutlineLockClosed } from "react-icons/hi2";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="page w-full max-w-2xl">
      <div className="space-y-2">
        <p className="section-title flex items-center gap-2">
          <HiOutlineShieldCheck className="text-base" />
          セキュリティ
        </p>
        <h1 className="page-title flex items-center gap-3">
          <HiOutlineLockClosed className="text-2xl" />
          パスワード更新
        </h1>
        <p className="page-subtitle">
          新しいパスワードを設定してください
        </p>
      </div>
      <div className="card">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
