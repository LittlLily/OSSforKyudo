import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  hasAdminOrSubPermission,
  requireUserWithSubPermissions,
} from "@/lib/permissions.server";
import {
  matchesAnyGroup,
  type TargetGroup,
  type TargetCondition,
} from "@/lib/surveys/targets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  opens_at: string | null;
  closes_at: string | null;
  is_anonymous: boolean;
  created_at: string;
  created_by: string | null;
};

const computeAvailability = (survey: SurveyRow, now: number) => {
  const opensAt = survey.opens_at ? Date.parse(survey.opens_at) : null;
  const closesAt = survey.closes_at ? Date.parse(survey.closes_at) : null;
  if (opensAt && now < opensAt) return "upcoming";
  if (closesAt && now > closesAt) return "closed";
  return "open";
};

export async function GET() {
  const auth = await requireUserWithSubPermissions();
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
    const profileResponse = await adminClient
      .from("profiles")
      .select("display_name, student_number, generation, gender")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profileResponse.error) throw profileResponse.error;

    let surveyQuery = adminClient
      .from("surveys")
      .select(
        "id, title, description, status, opens_at, closes_at, is_anonymous, created_at, created_by"
      )
      .order("created_at", { ascending: false });

    if (!hasAdminOrSubPermission(auth, "survey_admin")) {
      surveyQuery = surveyQuery.neq("status", "draft");
    }

    const surveyResponse = await surveyQuery;
    if (surveyResponse.error) throw surveyResponse.error;
    const surveys = (surveyResponse.data ?? []) as SurveyRow[];
    const surveyIds = surveys.map((survey) => survey.id);

    let groupsBySurvey = new Map<string, TargetGroup[]>();
    if (surveyIds.length > 0) {
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

      groupsBySurvey = new Map<string, TargetGroup[]>();
      for (const group of groupMap.values()) {
        const list = groupsBySurvey.get(group.surveyId) ?? [];
        list.push({ id: group.id, conditions: group.conditions });
        groupsBySurvey.set(group.surveyId, list);
      }
    }

    const targetResponse = surveyIds.length
      ? await adminClient
          .from("survey_targets")
          .select("survey_id, account_id")
          .in("survey_id", surveyIds)
      : { data: [], error: null };
    if (targetResponse.error) throw targetResponse.error;

    const targetSurveyIds = new Set<string>();
    const targetedBySurvey = new Set<string>();
    for (const row of targetResponse.data ?? []) {
      const surveyId = row.survey_id as string;
      targetSurveyIds.add(surveyId);
      if (row.account_id === auth.userId) {
        targetedBySurvey.add(surveyId);
      }
    }

    const responseResponse = surveyIds.length
      ? await adminClient
          .from("survey_responses")
          .select("id, survey_id")
          .eq("account_id", auth.userId)
          .in("survey_id", surveyIds)
      : { data: [], error: null };

    if (responseResponse.error) throw responseResponse.error;

    const responsesBySurvey = new Set(
      (responseResponse.data ?? []).map((row) => row.survey_id as string)
    );

    const now = Date.now();
    const profile = profileResponse.data ?? {};

    const list = surveys.map((survey) => {
      const groups = groupsBySurvey.get(survey.id) ?? [];
      const hasTargets = targetSurveyIds.has(survey.id);
      const eligible = hasTargets
        ? targetedBySurvey.has(survey.id)
        : matchesAnyGroup(profile, groups);
      const responded = responsesBySurvey.has(survey.id);
      const availability = computeAvailability(survey, now);
      const canAnswer =
        survey.status === "open" &&
        availability === "open" &&
        eligible;
      return {
        ...survey,
        eligible,
        responded,
        availability,
        canAnswer,
        requiresResponse: eligible && !responded,
      };
    });

    return NextResponse.json({ surveys: list, role: auth.role });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "fetch failed") },
      { status: 500 }
    );
  }
}
