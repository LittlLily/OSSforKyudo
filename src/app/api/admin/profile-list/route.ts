import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function requireUser() {
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
  return { ok: true, role };
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing supabase service role config");
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function listAllUsers(
  adminClient: ReturnType<typeof getAdminClient>
) {
  const users = [];
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
    users.push(...data.users);
    page = data.nextPage ?? 0;
  }

  return users;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const filters = {
    display_name: url.searchParams.get("display_name")?.trim() ?? "",
    student_number: url.searchParams.get("student_number")?.trim() ?? "",
    generation: url.searchParams.get("generation")?.trim() ?? "",
    gender: url.searchParams.get("gender")?.trim() ?? "",
    department: url.searchParams.get("department")?.trim() ?? "",
    ryuha: url.searchParams.get("ryuha")?.trim() ?? "",
    position: url.searchParams.get("position")?.trim() ?? "",
  };

  let adminClient;
  try {
    adminClient = getAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "config error" },
      { status: 500 }
    );
  }

  try {
    let profilesQuery = adminClient
      .from("profiles")
      .select(
        "id, display_name, student_number, name_kana, generation, gender, department, ryuha, position"
      );

    if (filters.display_name) {
      profilesQuery = profilesQuery.ilike(
        "display_name",
        `%${filters.display_name}%`
      );
    }
    if (filters.student_number) {
      profilesQuery = profilesQuery.ilike(
        "student_number",
        `%${filters.student_number}%`
      );
    }
    if (filters.generation) {
      const generationParts = filters.generation
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (generationParts.length > 1) {
        profilesQuery = profilesQuery.in("generation", generationParts);
      } else {
        profilesQuery = profilesQuery.ilike(
          "generation",
          `%${filters.generation}%`
        );
      }
    }
    if (filters.gender) {
      profilesQuery = profilesQuery.eq("gender", filters.gender);
    }
    if (filters.department) {
      profilesQuery = profilesQuery.ilike(
        "department",
        `%${filters.department}%`
      );
    }
    if (filters.ryuha) {
      profilesQuery = profilesQuery.ilike("ryuha", `%${filters.ryuha}%`);
    }
    if (filters.position) {
      profilesQuery = profilesQuery.ilike(
        "position",
        `%${filters.position}%`
      );
    }

    const profilesResponse = await profilesQuery;

    if (profilesResponse.error) {
      throw profilesResponse.error;
    }

    if (auth.role !== "admin") {
      const limited = (profilesResponse.data ?? []).map((profile) => ({
        id: profile.id,
        display_name: profile.display_name ?? null,
        student_number: profile.student_number ?? null,
        generation: profile.generation ?? null,
        department: profile.department ?? null,
        ryuha: profile.ryuha ?? null,
        position: profile.position ?? null,
      }));
      return NextResponse.json({ users: limited });
    }

    const users = await listAllUsers(adminClient);
    const profilesById = new Map(
      (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
    );

    const list = users
      .filter((user) => profilesById.has(user.id))
      .map((user) => {
        const profile = profilesById.get(user.id);
        return {
          id: user.id,
          email: user.email ?? null,
          role: (user.app_metadata?.role as "admin" | "user") ?? "user",
          display_name: profile?.display_name ?? null,
          student_number: profile?.student_number ?? null,
          name_kana: profile?.name_kana ?? null,
          generation: profile?.generation ?? null,
          gender: profile?.gender ?? null,
          department: profile?.department ?? null,
          ryuha: profile?.ryuha ?? null,
          position: profile?.position ?? null,
        };
      });

    return NextResponse.json({ users: list });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "fetch failed" },
      { status: 500 }
    );
  }
}
