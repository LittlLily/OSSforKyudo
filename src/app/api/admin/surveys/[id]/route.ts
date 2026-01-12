import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

type QuestionPayload = {
  prompt?: string;
  type?: "single" | "multiple";
  allowOptionAdd?: boolean;
  options?: string[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
      .eq("id", id)
      .maybeSingle();
    if (surveyResponse.error) throw surveyResponse.error;
    if (!surveyResponse.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const questionResponse = await adminClient
      .from("survey_questions")
      .select("id, prompt, type, allow_option_add, position")
      .eq("survey_id", id)
      .order("position", { ascending: true });
    if (questionResponse.error) throw questionResponse.error;
    const questions = questionResponse.data ?? [];
    const questionIds = questions.map((question) => question.id as string);

    const optionsResponse =
      questionIds.length > 0
        ? await adminClient
            .from("survey_options")
            .select("id, question_id, label")
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

    const targetsResponse = await adminClient
      .from("survey_targets")
      .select("account_id")
      .eq("survey_id", id);
    if (targetsResponse.error) throw targetsResponse.error;
    const targetAccountIds = (targetsResponse.data ?? []).map(
      (row) => row.account_id as string
    );

    const profileResponse =
      targetAccountIds.length > 0
        ? await adminClient
            .from("profiles")
            .select("id, display_name, student_number, generation, gender")
            .in("id", targetAccountIds)
        : { data: [], error: null };
    if (profileResponse.error) throw profileResponse.error;

    const targets = (profileResponse.data ?? []).map((profile) => ({
      id: profile.id as string,
      display_name: profile.display_name ?? null,
      student_number: profile.student_number ?? null,
      generation: profile.generation ?? null,
      gender: profile.gender ?? null,
    }));

    return NextResponse.json({
      survey: surveyResponse.data,
      questions: questions.map((question) => ({
        ...question,
        options: optionsByQuestion.get(question.id as string) ?? [],
      })),
      targets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "fetch failed") },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    const currentSurvey = await adminClient
      .from("surveys")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (currentSurvey.error) throw currentSurvey.error;
    if (!currentSurvey.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (currentSurvey.data.status !== "draft") {
      return NextResponse.json(
        { error: "only draft can be edited" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      status?: "draft" | "open" | "closed";
      opens_at?: string | null;
      closes_at?: string | null;
      is_anonymous?: boolean;
      accountIds?: string[];
      questions?: QuestionPayload[];
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const questions = Array.isArray(body.questions) ? body.questions : [];
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "questions required" },
        { status: 400 }
      );
    }

    const normalizedQuestions = questions.map((question) => ({
      prompt: question.prompt?.trim() ?? "",
      type: question.type === "multiple" ? "multiple" : "single",
      allowOptionAdd: Boolean(question.allowOptionAdd),
      options: Array.isArray(question.options)
        ? question.options.map((option) => option.trim()).filter(Boolean)
        : [],
    }));

    if (normalizedQuestions.some((question) => !question.prompt)) {
      return NextResponse.json(
        { error: "question prompt required" },
        { status: 400 }
      );
    }

    if (normalizedQuestions.some((question) => question.options.length === 0)) {
      return NextResponse.json(
        { error: "each question needs at least one option" },
        { status: 400 }
      );
    }

    const accountIds = Array.isArray(body.accountIds)
      ? body.accountIds.map((id) => id.trim()).filter(Boolean)
      : [];
    if (accountIds.length === 0) {
      return NextResponse.json(
        { error: "accountIds required" },
        { status: 400 }
      );
    }

    const status =
      body.status && ["draft", "open", "closed"].includes(body.status)
        ? body.status
        : "draft";

    const updateResponse = await adminClient
      .from("surveys")
      .update({
        title,
        description: body.description?.trim() ?? null,
        status,
        opens_at: body.opens_at ?? null,
        closes_at: body.closes_at ?? null,
        is_anonymous: Boolean(body.is_anonymous),
      })
      .eq("id", id);
    if (updateResponse.error) throw updateResponse.error;

    const responseIdResponse = await adminClient
      .from("survey_responses")
      .select("id")
      .eq("survey_id", id);
    if (responseIdResponse.error) throw responseIdResponse.error;

    const responseIds = (responseIdResponse.data ?? []).map(
      (row) => row.id as string
    );
    if (responseIds.length > 0) {
      const responseDelete = await adminClient
        .from("survey_response_answers")
        .delete()
        .in("response_id", responseIds);
      if (responseDelete.error) throw responseDelete.error;
    }

    const responsesDelete = await adminClient
      .from("survey_responses")
      .delete()
      .eq("survey_id", id);
    if (responsesDelete.error) throw responsesDelete.error;

    const questionIdResponse = await adminClient
      .from("survey_questions")
      .select("id")
      .eq("survey_id", id);
    if (questionIdResponse.error) throw questionIdResponse.error;

    const questionIds = (questionIdResponse.data ?? []).map(
      (row) => row.id as string
    );
    if (questionIds.length > 0) {
      const deleteOptions = await adminClient
        .from("survey_options")
        .delete()
        .in("question_id", questionIds);
      if (deleteOptions.error) throw deleteOptions.error;
    }

    const deleteQuestions = await adminClient
      .from("survey_questions")
      .delete()
      .eq("survey_id", id);
    if (deleteQuestions.error) throw deleteQuestions.error;

    const deleteTargets = await adminClient
      .from("survey_targets")
      .delete()
      .eq("survey_id", id);
    if (deleteTargets.error) throw deleteTargets.error;

    const questionRows = normalizedQuestions.map((question, index) => ({
      survey_id: id,
      prompt: question.prompt,
      type: question.type,
      allow_option_add: question.allowOptionAdd,
      position: index,
    }));

    const insertedQuestions = await adminClient
      .from("survey_questions")
      .insert(questionRows)
      .select("id, position");
    if (insertedQuestions.error) throw insertedQuestions.error;

    const questionIdByPosition = new Map<number, string>();
    for (const row of insertedQuestions.data ?? []) {
      questionIdByPosition.set(row.position as number, row.id as string);
    }

    const optionRows: {
      question_id: string;
      label: string;
      created_by: string;
    }[] = [];

    normalizedQuestions.forEach((question, index) => {
      const questionId = questionIdByPosition.get(index);
      if (!questionId) return;
      for (const option of question.options) {
        optionRows.push({
          question_id: questionId,
          label: option,
          created_by: auth.userId,
        });
      }
    });

    const insertOptions = await adminClient
      .from("survey_options")
      .insert(optionRows);
    if (insertOptions.error) throw insertOptions.error;

    const uniqueAccountIds = Array.from(new Set(accountIds));
    const targetRows = uniqueAccountIds.map((accountId) => ({
      survey_id: id,
      account_id: accountId,
    }));
    const insertTargets = await adminClient
      .from("survey_targets")
      .insert(targetRows);
    if (insertTargets.error) throw insertTargets.error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "update failed") },
      { status: 500 }
    );
  }
}
