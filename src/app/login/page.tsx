import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    typeof params?.next === "string" ? params.next : "/dashboard";

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-2xl font-bold">Login</h1>
      <h1 className="text-2xl font-bold">V0.0.3</h1>
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
