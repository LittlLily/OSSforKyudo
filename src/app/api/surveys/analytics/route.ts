import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  resolveAccountIdsForTargetGroups,
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

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "start and end are required" },
      { status: 400 }
    );
  }

  const startAt = new Date(startParam);
  const endAt = new Date(endParam);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
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
    const surveysResponse = await adminClient
      .from("surveys")
      .select("id, status, opens_at, created_at")
      .neq("status", "draft")
      .gte("created_at", startAt.toISOString())
      .lte("created_at", endAt.toISOString());
    if (surveysResponse.error) throw surveysResponse.error;

    const surveys = surveysResponse.data ?? [];
    const surveyIds = surveys.map((survey) => survey.id as string);
    if (surveyIds.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const targetResponse = await adminClient
      .from("survey_targets")
      .select("survey_id, account_id")
      .in("survey_id", surveyIds);
    if (targetResponse.error) throw targetResponse.error;

    const targetAccountIdsBySurvey = new Map<string, string[]>();
    for (const row of targetResponse.data ?? []) {
      const surveyId = row.survey_id as string;
      const list = targetAccountIdsBySurvey.get(surveyId) ?? [];
      list.push(row.account_id as string);
      targetAccountIdsBySurvey.set(surveyId, list);
    }

    const groupsResponse = await adminClient
      .from("survey_target_groups")
      .select("id, survey_id, position")
      .in("survey_id", surveyIds)
      .order("position", { ascending: true });
    if (groupsResponse.error) throw groupsResponse.error;

    const groupRows = groupsResponse.data ?? [];
    const groupIds = groupRows.map((group) => group.id as string);
    const groupMap = new Map<string, TargetGroup & { surveyId: string }>();
    for (const group of groupRows) {
      groupMap.set(group.id as string, {
        id: group.id as string,
        surveyId: group.survey_id as string,
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

    const groupsBySurvey = new Map<string, TargetGroup[]>();
    for (const group of groupMap.values()) {
      const list = groupsBySurvey.get(group.surveyId) ?? [];
      list.push({ id: group.id, conditions: group.conditions });
      groupsBySurvey.set(group.surveyId, list);
    }

    const profilesResponse = await adminClient
      .from("profiles")
      .select("id, display_name, student_number");
    if (profilesResponse.error) throw profilesResponse.error;

    const profileById = new Map<
      string,
      { display_name: string | null; student_number: string | null }
    >(
      (profilesResponse.data ?? []).map((profile) => [
        profile.id as string,
        {
          display_name: profile.display_name ?? null,
          student_number: profile.student_number ?? null,
        },
      ])
    );

    const stats = new Map<string, { eligible: number; responded: number }>();

    const allProfileIds = Array.from(profileById.keys());

    for (const survey of surveys) {
      const surveyId = survey.id as string;
      const explicitTargets = targetAccountIdsBySurvey.get(surveyId) ?? [];
      let eligibleAccountIds: string[] = [];

      if (explicitTargets.length > 0) {
        eligibleAccountIds = explicitTargets;
      } else {
        const targetGroups = groupsBySurvey.get(surveyId) ?? [];
        if (targetGroups.length > 0) {
          eligibleAccountIds = await resolveAccountIdsForTargetGroups(
            adminClient,
            targetGroups
          );
        } else {
          eligibleAccountIds = allProfileIds;
        }
      }

      eligibleAccountIds.forEach((accountId) => {
        const current = stats.get(accountId) ?? { eligible: 0, responded: 0 };
        current.eligible += 1;
        stats.set(accountId, current);
      });

      if (eligibleAccountIds.length === 0) continue;

      const responsesResponse = await adminClient
        .from("survey_responses")
        .select("account_id")
        .eq("survey_id", surveyId)
        .in("account_id", eligibleAccountIds);
      if (responsesResponse.error) throw responsesResponse.error;

      for (const row of responsesResponse.data ?? []) {
        const accountId = row.account_id as string;
        const current = stats.get(accountId) ?? { eligible: 0, responded: 0 };
        current.responded += 1;
        stats.set(accountId, current);
      }
    }

    const rows = Array.from(stats.entries())
      .filter(([, value]) => value.eligible > 0)
      .map(([accountId, value]) => ({
        account_id: accountId,
        display_name: profileById.get(accountId)?.display_name ?? null,
        student_number: profileById.get(accountId)?.student_number ?? null,
        eligible: value.eligible,
        responded: value.responded,
        responseRate:
          value.eligible === 0
            ? 0
            : Math.round((value.responded / value.eligible) * 1000) / 10,
      }));

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "fetch failed") },
      { status: 500 }
    );
  }
}
