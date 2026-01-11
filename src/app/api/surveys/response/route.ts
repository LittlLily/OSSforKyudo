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

type AnswerPayload = {
  questionId: string;
  optionIds: string[];
};

const computeAvailability = (
  survey: {
    opens_at: string | null;
    closes_at: string | null;
  },
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
      surveyId?: string;
      answers?: AnswerPayload[];
    };

    const surveyId = body.surveyId?.trim();
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!surveyId) {
      return NextResponse.json({ error: "surveyId required" }, { status: 400 });
    }

    const surveyResponse = await adminClient
      .from("surveys")
      .select("id, status, opens_at, closes_at")
      .eq("id", surveyId)
      .maybeSingle();
    if (surveyResponse.error) throw surveyResponse.error;
    if (!surveyResponse.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const survey = surveyResponse.data;
    const availability = computeAvailability(survey, Date.now());
    if (survey.status !== "open" || availability !== "open") {
      return NextResponse.json(
        { error: "survey is not accepting responses" },
        { status: 400 }
      );
    }

    const groupsResponse = await adminClient
      .from("survey_target_groups")
      .select("id, survey_id, position")
      .eq("survey_id", surveyId)
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

    const targetGroups = Array.from(groupMap.values());

    const profileResponse = await adminClient
      .from("profiles")
      .select("display_name, student_number, generation, gender")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profileResponse.error) throw profileResponse.error;
    const profile = profileResponse.data ?? {};
    const eligible = matchesAnyGroup(profile, targetGroups);
    if (!eligible) {
      return NextResponse.json({ error: "not eligible" }, { status: 403 });
    }

    const questionResponse = await adminClient
      .from("survey_questions")
      .select("id, type")
      .eq("survey_id", surveyId);
    if (questionResponse.error) throw questionResponse.error;
    const questions = questionResponse.data ?? [];
    const questionIds = questions.map((question) => question.id as string);

    if (!questionIds.length) {
      return NextResponse.json(
        { error: "survey has no questions" },
        { status: 400 }
      );
    }

    const optionResponse = await adminClient
      .from("survey_options")
      .select("id, question_id")
      .in("question_id", questionIds);
    if (optionResponse.error) throw optionResponse.error;
    const optionsByQuestion = new Map<string, Set<string>>();
    for (const option of optionResponse.data ?? []) {
      const set =
        optionsByQuestion.get(option.question_id as string) ?? new Set<string>();
      set.add(option.id as string);
      optionsByQuestion.set(option.question_id as string, set);
    }

    const answersByQuestion = new Map<string, string[]>();
    for (const answer of answers) {
      if (!answer?.questionId) continue;
      answersByQuestion.set(
        answer.questionId,
        Array.isArray(answer.optionIds) ? answer.optionIds : []
      );
    }

    const rows: { questionId: string; optionIds: string[] }[] = [];
    for (const question of questions) {
      const questionId = question.id as string;
      const optionIds = answersByQuestion.get(questionId) ?? [];
      const trimmed = Array.from(new Set(optionIds.filter(Boolean)));
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "all questions must be answered" },
          { status: 400 }
        );
      }
      if (question.type === "single" && trimmed.length !== 1) {
        return NextResponse.json(
          { error: "single choice requires one option" },
          { status: 400 }
        );
      }
      const allowedOptions = optionsByQuestion.get(questionId) ?? new Set();
      for (const optionId of trimmed) {
        if (!allowedOptions.has(optionId)) {
          return NextResponse.json(
            { error: "invalid option" },
            { status: 400 }
          );
        }
      }
      rows.push({ questionId, optionIds: trimmed });
    }

    const existingResponse = await adminClient
      .from("survey_responses")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("account_id", auth.userId)
      .maybeSingle();
    if (existingResponse.error) throw existingResponse.error;

    let responseId: string;
    if (existingResponse.data?.id) {
      responseId = existingResponse.data.id as string;
      const updateResponse = await adminClient
        .from("survey_responses")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", responseId);
      if (updateResponse.error) throw updateResponse.error;
    } else {
      const insertResponse = await adminClient
        .from("survey_responses")
        .insert({ survey_id: surveyId, account_id: auth.userId })
        .select("id")
        .maybeSingle();
      if (insertResponse.error) throw insertResponse.error;
      if (!insertResponse.data) {
        return NextResponse.json({ error: "create failed" }, { status: 500 });
      }
      responseId = insertResponse.data.id as string;
    }

    const deleteResponse = await adminClient
      .from("survey_response_answers")
      .delete()
      .eq("response_id", responseId);
    if (deleteResponse.error) throw deleteResponse.error;

    const answerRows = rows.flatMap((row) =>
      row.optionIds.map((optionId) => ({
        response_id: responseId,
        question_id: row.questionId,
        option_id: optionId,
      }))
    );

    const insertAnswers = await adminClient
      .from("survey_response_answers")
      .insert(answerRows);
    if (insertAnswers.error) throw insertAnswers.error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "submit failed") },
      { status: 500 }
    );
  }
}
