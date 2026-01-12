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
        maxAge: 60 * 60 * 2,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    }
  );
}
