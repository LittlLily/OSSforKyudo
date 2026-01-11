import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer, CookieOptions } from "@supabase/ssr";

type CookieStore = {
  getAll(): { name: string; value: string }[];
  set?(
    name: string,
    value: string,
    options?: CookieOptions
  ): void;
};

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export function createClient(cookieStore: CookieStore) {
  const canSetCookies = typeof cookieStore.set === "function";
  const isE2EHttp =
    (process.env.E2E_BASE_URL ?? "").startsWith("http://");

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    ...(canSetCookies
      ? {
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
              cookieStore.set?.(name, value, options);
            });
          },
        }
      : {}),
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieMethods,
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" && !isE2EHttp,
        path: "/",
      },
    }
  );
}
