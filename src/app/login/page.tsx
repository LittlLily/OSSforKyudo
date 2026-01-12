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
        <p className="section-title">Access</p>
        <h1 className="page-title">Login</h1>
        <p className="page-subtitle">Enterprise sign-in portal</p>
      </div>
      <div className="card">
        <LoginForm nextPath={nextPath} />
      </div>
      <div className="text-xs text-[color:var(--muted)]">V0.0.0</div>
    </main>
  );
}
