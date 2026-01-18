import { HiOutlineShieldCheck, HiOutlineKey } from "react-icons/hi2";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="page w-full max-w-2xl">
      <div className="space-y-2">
        <p className="section-title flex items-center gap-2">
          <HiOutlineShieldCheck className="text-base" />
          アクセス
        </p>
        <h1 className="page-title flex items-center gap-3">
          <HiOutlineKey className="text-2xl" />
          パスワード再設定
        </h1>
        <p className="page-subtitle">
          登録済みのメールアドレスに再設定リンクを送信します
        </p>
      </div>
      <div className="card">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
