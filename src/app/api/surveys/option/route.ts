import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  matchesAnyGroup,
  type TargetCondition,
  type TargetGroup,
} from "@/lib/surveys/targets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AuthResult =
  | { ok: true; role: "admin" | "user"; userId: string }
  | { ok: false; status: number; message: string };

async function requireUser(): Promise<AuthResult> {
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
  return { ok: true, role, userId: data.user.id };
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing supabase service role config");
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

const computeAvailability = (
  survey: { opens_at: string | null; closes_at: string | null },
  now: number
) => {
  const opensAt = survey.opens_at ? Date.parse(survey.opens_at) : null;
  const closesAt = survey.closes_at ? Date.parse(survey.closes_at) : null;
  if (opensAt && now < opensAt) return "upcoming";
  if (closesAt && now > closesAt) return "closed";
  return "open";
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
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

  try {
    const body = (await request.json()) as {
      questionId?: string;
      label?: string;
    };
    const questionId = body.questionId?.trim();
    const label = body.label?.trim();

    if (!questionId || !label) {
      return NextResponse.json(
        { error: "questionId and label required" },
        { status: 400 }
      );
    }

    const questionResponse = await adminClient
      .from("survey_questions")
      .select("id, survey_id, allow_option_add")
      .eq("id", questionId)
      .maybeSingle();
    if (questionResponse.error) throw questionResponse.error;
    if (!questionResponse.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    if (!questionResponse.data.allow_option_add) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const surveyResponse = await adminClient
      .from("surveys")
      .select("id, status, opens_at, closes_at")
      .eq("id", questionResponse.data.survey_id)
      .maybeSingle();
    if (surveyResponse.error) throw surveyResponse.error;
    if (!surveyResponse.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const availability = computeAvailability(surveyResponse.data, Date.now());
    if (surveyResponse.data.status !== "open" || availability !== "open") {
      return NextResponse.json(
        { error: "survey is not accepting responses" },
        { status: 400 }
      );
    }

    const groupsResponse = await adminClient
      .from("survey_target_groups")
      .select("id, survey_id, position")
      .eq("survey_id", surveyResponse.data.id)
      .order("position", { ascending: true });
    if (groupsResponse.error) throw groupsResponse.error;
    const groupRows = groupsResponse.data ?? [];
    const groupIds = groupRows.map((group) => group.id as string);
    const groupMap = new Map<string, TargetGroup>();
    for (const group of groupRows) {
      groupMap.set(group.id as string, {
        id: group.id as string,
        conditions: [],
      });
    }

    if (groupIds.length > 0) {
      const conditionsResponse = await adminClient
        .from("survey_target_conditions")
        .select("group_id, field, op, value")
        .in("group_id", groupIds);
      if (conditionsResponse.error) throw conditionsResponse.error;
      for (const row of conditionsResponse.data ?? []) {
        const group = groupMap.get(row.group_id as string);
        if (!group) continue;
        group.conditions.push({
          field: row.field as TargetCondition["field"],
          op: row.op as TargetCondition["op"],
          value: row.value as string,
        });
      }
    }

    const profileResponse = await adminClient
      .from("profiles")
      .select("display_name, student_number, generation, gender")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profileResponse.error) throw profileResponse.error;

    const eligible = matchesAnyGroup(
      profileResponse.data ?? {},
      Array.from(groupMap.values())
    );

    if (!eligible) {
      return NextResponse.json({ error: "not eligible" }, { status: 403 });
    }

    const insertResponse = await adminClient
      .from("survey_options")
      .insert({
        question_id: questionId,
        label,
        created_by: auth.userId,
      })
      .select("id, question_id, label, created_by, created_at")
      .maybeSingle();
    if (insertResponse.error) throw insertResponse.error;

    return NextResponse.json({ option: insertResponse.data });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "create failed") },
      { status: 500 }
    );
  }
}
