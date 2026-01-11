import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  matchesAnyGroup,
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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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
    const surveyResponse = await adminClient
      .from("surveys")
      .select(
        "id, title, description, status, opens_at, closes_at, is_anonymous, created_at, created_by"
      )
      .eq("id", params.id)
      .maybeSingle();
    if (surveyResponse.error) throw surveyResponse.error;
    if (!surveyResponse.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const survey = surveyResponse.data as SurveyRow;
    if (auth.role !== "admin" && survey.status === "draft") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const questionResponse = await adminClient
      .from("survey_questions")
      .select("id, prompt, type, allow_option_add, position")
      .eq("survey_id", survey.id)
      .order("position", { ascending: true });
    if (questionResponse.error) throw questionResponse.error;
    const questions = questionResponse.data ?? [];
    const questionIds = questions.map((question) => question.id as string);

    const optionsResponse =
      questionIds.length > 0
        ? await adminClient
            .from("survey_options")
            .select("id, question_id, label, created_by, created_at")
            .in("question_id", questionIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null };
    if (optionsResponse.error) throw optionsResponse.error;

    const optionsByQuestion = new Map<string, typeof optionsResponse.data>();
    for (const option of optionsResponse.data ?? []) {
      const list = optionsByQuestion.get(option.question_id as string) ?? [];
      list.push(option);
      optionsByQuestion.set(option.question_id as string, list);
    }

    const groupsResponse = await adminClient
      .from("survey_target_groups")
      .select("id, survey_id, position")
      .eq("survey_id", survey.id)
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

    const targetGroups: TargetGroup[] = Array.from(groupMap.values()).map(
      (group) => ({
        id: group.id,
        conditions: group.conditions,
      })
    );

    const profileResponse = await adminClient
      .from("profiles")
      .select("display_name, student_number, generation, gender")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profileResponse.error) throw profileResponse.error;

    const profile = profileResponse.data ?? {};
    const eligible = matchesAnyGroup(profile, targetGroups);
    const availability = computeAvailability(survey, Date.now());
    const canAnswer =
      survey.status === "open" && availability === "open" && eligible;

    const responseResponse = await adminClient
      .from("survey_responses")
      .select("id, created_at, updated_at")
      .eq("survey_id", survey.id)
      .eq("account_id", auth.userId)
      .maybeSingle();
    if (responseResponse.error) throw responseResponse.error;

    const response = responseResponse.data ?? null;
    const answerResponse = response
      ? await adminClient
          .from("survey_response_answers")
          .select("question_id, option_id")
          .eq("response_id", response.id)
      : { data: [], error: null };
    if (answerResponse.error) throw answerResponse.error;

    const answersByQuestion = new Map<string, string[]>();
    for (const row of answerResponse.data ?? []) {
      const list = answersByQuestion.get(row.question_id as string) ?? [];
      list.push(row.option_id as string);
      answersByQuestion.set(row.question_id as string, list);
    }

    let eligibleAccountIds: string[] = [];
    let eligibleCount = 0;
    let respondedAccountIds = new Set<string>();
    if (targetGroups.length === 0) {
      const profilesResponse = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: false });
      if (profilesResponse.error) throw profilesResponse.error;
      eligibleAccountIds = (profilesResponse.data ?? []).map(
        (row) => row.id as string
      );
      eligibleCount =
        typeof profilesResponse.count === "number"
          ? profilesResponse.count
          : eligibleAccountIds.length;
    } else {
      eligibleAccountIds = await resolveAccountIdsForTargetGroups(
        adminClient,
        targetGroups
      );
      eligibleCount = eligibleAccountIds.length;
    }

    const responseRows =
      eligibleAccountIds.length > 0
        ? await adminClient
            .from("survey_responses")
            .select("id, account_id")
            .eq("survey_id", survey.id)
            .in("account_id", eligibleAccountIds)
        : { data: [], error: null };
    if (responseRows.error) throw responseRows.error;

    const responseIds = (responseRows.data ?? []).map((row) => row.id as string);
    respondedAccountIds = new Set(
      (responseRows.data ?? []).map((row) => row.account_id as string)
    );

    const answersResponse =
      responseIds.length > 0
        ? await adminClient
            .from("survey_response_answers")
            .select("question_id, option_id, response_id")
            .in("response_id", responseIds)
        : { data: [], error: null };
    if (answersResponse.error) throw answersResponse.error;

    const countsByOption = new Map<string, number>();
    const responseIdToAccountId = new Map<string, string>();
    for (const row of responseRows.data ?? []) {
      responseIdToAccountId.set(row.id as string, row.account_id as string);
    }

    const accountIdsByOption = new Map<string, Set<string>>();
    for (const row of answersResponse.data ?? []) {
      const optionId = row.option_id as string;
      countsByOption.set(optionId, (countsByOption.get(optionId) ?? 0) + 1);
      const accountId = responseIdToAccountId.get(row.response_id as string);
      if (accountId) {
        const set = accountIdsByOption.get(optionId) ?? new Set<string>();
        set.add(accountId);
        accountIdsByOption.set(optionId, set);
      }
    }

    const respondedCount = respondedAccountIds.size;

    const unrespondedIds = eligibleAccountIds.filter(
      (id) => !respondedAccountIds.has(id)
    );

    const unrespondedProfiles =
      unrespondedIds.length > 0
        ? await adminClient
            .from("profiles")
            .select("id, display_name, student_number")
            .in("id", unrespondedIds)
        : { data: [], error: null };
    if (unrespondedProfiles.error) throw unrespondedProfiles.error;

    let respondedProfiles = new Map<
      string,
      { id: string; display_name: string | null; student_number: string | null }
    >();
    if (!survey.is_anonymous && respondedAccountIds.size > 0) {
      const profileResponse = await adminClient
        .from("profiles")
        .select("id, display_name, student_number")
        .in("id", Array.from(respondedAccountIds));
      if (profileResponse.error) throw profileResponse.error;
      respondedProfiles = new Map(
        (profileResponse.data ?? []).map((profile) => [
          profile.id as string,
          {
            id: profile.id as string,
            display_name: profile.display_name ?? null,
            student_number: profile.student_number ?? null,
          },
        ])
      );
    }

    const respondentsByOption: Record<
      string,
      { id: string; display_name: string | null; student_number: string | null }[]
    > = {};
    if (!survey.is_anonymous) {
      for (const [optionId, accountIds] of accountIdsByOption.entries()) {
        const list = Array.from(accountIds)
          .map((accountId) => respondedProfiles.get(accountId))
          .filter(
            (
              profile
            ): profile is {
              id: string;
              display_name: string | null;
              student_number: string | null;
            } => Boolean(profile)
          );
        respondentsByOption[optionId] = list;
      }
    }

    const payload = {
      survey,
      availability,
      eligible,
      canAnswer,
      targets: targetGroups,
      response: response
        ? {
            id: response.id,
            created_at: response.created_at,
            updated_at: response.updated_at,
            answers: Object.fromEntries(answersByQuestion),
          }
        : null,
      questions: questions.map((question) => ({
        ...question,
        options: optionsByQuestion.get(question.id as string) ?? [],
      })),
      results: {
        eligibleCount,
        respondedCount,
        responseRate:
          eligibleCount === 0
            ? 0
            : Math.round((respondedCount / eligibleCount) * 1000) / 10,
        countsByOption: Object.fromEntries(countsByOption),
        respondentsByOption,
        unresponded:
          unrespondedProfiles.data?.map((profile) => ({
            id: profile.id,
            display_name: profile.display_name ?? null,
            student_number: profile.student_number ?? null,
          })) ?? [],
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "fetch failed") },
      { status: 500 }
    );
  }
}
