import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeSubPermissions,
  type SubPermission,
} from "@/lib/permissions";

export type AuthWithSubPermissions =
  | {
      ok: true;
      userId: string;
      role: "admin" | "user";
      subPermissions: SubPermission[];
    }
  | { ok: false; status: number; message: string };

export async function requireUserWithSubPermissions(): Promise<AuthWithSubPermissions> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { ok: false, status: 500, message: error.message };
  }
  if (!data.user) {
    return { ok: false, status: 401, message: "unauthorized" };
  }

  const role =
    (data.user.app_metadata?.role as "admin" | "user") ?? "user";
  const profileResponse = await supabase
    .from("profiles")
    .select("sub_permissions")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileResponse.error) {
    return {
      ok: false,
      status: 500,
      message: profileResponse.error.message,
    };
  }

  return {
    ok: true,
    userId: data.user.id,
    role,
    subPermissions: normalizeSubPermissions(
      profileResponse.data?.sub_permissions
    ),
  };
}

export function hasAdminOrSubPermission(
  auth: Extract<AuthWithSubPermissions, { ok: true }>,
  permission: SubPermission
) {
  return auth.role === "admin" || auth.subPermissions.includes(permission);
}
