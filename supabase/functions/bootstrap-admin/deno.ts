declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve(
      handler: (req: Request) => Response | Promise<Response>,
    ): void;
  };
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: (...args: unknown[]) => unknown;
}

export {};
