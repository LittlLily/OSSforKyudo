import { createServerClient } from "@supabase/ssr";

type CookieStore = {
  getAll(): { name: string; value: string }[];
  set?(
    name: string,
    value: string,
    options?: {
      domain?: string;
      expires?: Date;
      httpOnly?: boolean;
      maxAge?: number;
      path?: string;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
    }
  ): void;
};

export function createClient(cookieStore: CookieStore) {
  const canSetCookies = typeof cookieStore.set === "function";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        ...(canSetCookies
          ? {
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set?.(name, value, options);
                });
              },
            }
          : {}),
      },
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    }
  );
}
