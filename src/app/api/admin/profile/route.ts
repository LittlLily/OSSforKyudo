import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAccountAction } from "@/lib/audit";
import { normalizeSubPermissions } from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type ProfileUpdate = {
  display_name?: string | null;
  student_number?: string | null;
  name_kana?: string | null;
  generation?: string | null;
  gender?: "male" | "female" | null;
  department?: string | null;
  ryuha?: string | null;
  position?: string | null;
  public_field_1?: string | null;
  public_field_2?: string | null;
  restricted_field_1?: string | null;
  restricted_field_2?: string | null;
  sub_permissions?: string[] | null;
};

type RoleUpdate = "admin" | "user";

async function requireAdmin() {
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
  if (role !== "admin") {
    return { ok: false, status: 403, message: "forbidden" };
  }

  return { ok: true, userId: data.user.id };
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing supabase service role config");
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function findUserIdByEmail(
  adminClient: ReturnType<typeof getAdminClient>,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (page > 0) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw error;
    }
    const user = data.users.find(
      (entry) => entry.email?.toLowerCase() === normalizedEmail
    );
    if (user) {
      return user.id;
    }
    page = data.nextPage ?? 0;
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  const emailParam = url.searchParams.get("email");
  if (!idParam && !emailParam) {
    return NextResponse.json({ error: "missing id or email" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = getAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "config error" },
      { status: 500 }
    );
  }

  let id = idParam ?? "";
  if (!id && emailParam) {
    try {
      const foundId = await findUserIdByEmail(adminClient, emailParam);
      if (!foundId) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      id = foundId;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "lookup failed" },
        { status: 500 }
      );
    }
  }

  const { data, error } = await adminClient
    .from("profiles")
    .select(
      "id, display_name, student_number, name_kana, generation, gender, department, ryuha, position, public_field_1, public_field_2, restricted_field_1, restricted_field_2, sub_permissions"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(id);

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const role =
    (userData.user?.app_metadata?.role as RoleUpdate | undefined) ?? "user";

  await logAccountAction(adminClient, {
    action: "プロフィール取得",
    operatorId: auth.userId,
    targetId: id,
    subjectUserId: id,
  });

  return NextResponse.json({ profile: data, role });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let payload: {
    id?: string;
    email?: string;
    profile?: ProfileUpdate;
    role?: RoleUpdate;
  };
  try {
    payload = (await request.json()) as {
      id?: string;
      email?: string;
      profile?: ProfileUpdate;
      role?: RoleUpdate;
    };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let id = payload.id ?? "";
  const email = payload.email ?? "";
  const requestedRole = payload.role;

  const profile = payload.profile ?? {};
  const update: ProfileUpdate = {};
  const allowedKeys: (keyof ProfileUpdate)[] = [
    "display_name",
    "student_number",
    "name_kana",
    "generation",
    "gender",
    "department",
    "ryuha",
    "position",
    "public_field_1",
    "public_field_2",
    "restricted_field_1",
    "restricted_field_2",
    "sub_permissions",
  ];

  allowedKeys.forEach((key) => {
    if (key in profile) {
      const value = profile[key];
      if (key === "gender") {
        if (value === "male" || value === "female" || value == null) {
          update[key] = value ?? null;
        }
        return;
      }
      if (key === "sub_permissions") {
        update[key] = normalizeSubPermissions(value);
        return;
      }
      update[key] = value ?? null;
    }
  });

  let adminClient;
  try {
    adminClient = getAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "config error" },
      { status: 500 }
    );
  }

  if (!id) {
    if (!email) {
      return NextResponse.json({ error: "missing id or email" }, { status: 400 });
    }
    try {
      const foundId = await findUserIdByEmail(adminClient, email);
      if (!foundId) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      id = foundId;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "lookup failed" },
        { status: 500 }
      );
    }
  }

  if (Object.keys(update).length === 0 && !requestedRole) {
    return NextResponse.json(
      { error: "no fields to update" },
      { status: 400 }
    );
  }

  if (requestedRole === "admin" || requestedRole === "user") {
    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(id);
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
    const appMetadata = userData.user?.app_metadata ?? {};
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      id,
      {
        app_metadata: { ...appMetadata, role: requestedRole },
      }
    );
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  let data;
  if (Object.keys(update).length > 0) {
    const response = await adminClient
      .from("profiles")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (response.error) {
      return NextResponse.json({ error: response.error.message }, { status: 400 });
    }

    data = response.data;
  }

  if (!data && Object.keys(update).length > 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await logAccountAction(adminClient, {
    action: "プロフィール更新",
    operatorId: auth.userId,
    targetId: id,
    subjectUserId: id,
  });

  return NextResponse.json({ ok: true, id });
}
