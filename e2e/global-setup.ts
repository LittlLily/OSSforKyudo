const email = process.env.E2E_USER_EMAIL ?? "demo@example.com";
const password = process.env.E2E_USER_PASSWORD ?? "password";

function pick(...names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

function mustPick(...names: string[]) {
  const v = pick(...names);
  if (!v) throw new Error(`Missing env. Tried: ${names.join(", ")}`);
  return v;
}

export default async function globalSetup() {
  const supabaseUrl = mustPick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");

  // supabase status -o env の出力差分を吸収
  const serviceRoleKey = mustPick(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SECRET_KEY" // あなたのログ上は "Secret" がこれに該当する可能性が高い
  );

  const endpoint = `${supabaseUrl}/auth/v1/admin/users`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (res.ok) return;

  const text = await res.text();

  if (res.ok) return;

  if (res.status === 400 || res.status === 409) return;

  if (res.status === 422) {
    try {
      const j = JSON.parse(text);
      if (j?.error_code === "email_exists") return;
    } catch {}
  }

  throw new Error(
    `Failed to ensure E2E user. status=${res.status} body=${text}`
  );
}
