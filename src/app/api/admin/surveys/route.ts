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


export async function POST(request: Request) {
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

    const status =
      body.status && ["draft", "open", "closed"].includes(body.status)
        ? body.status
        : "draft";

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

    const insertSurvey = await adminClient
      .from("surveys")
      .insert({
        title,
        description: body.description?.trim() ?? null,
        status,
        opens_at: body.opens_at ?? null,
        closes_at: body.closes_at ?? null,
        is_anonymous: Boolean(body.is_anonymous),
        created_by: auth.userId,
      })
      .select("id")
      .maybeSingle();
    if (insertSurvey.error) throw insertSurvey.error;
    if (!insertSurvey.data) {
      return NextResponse.json({ error: "create failed" }, { status: 500 });
    }

    const surveyId = insertSurvey.data.id as string;

    const questionRows = normalizedQuestions.map((question, index) => ({
      survey_id: surveyId,
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

    if (optionRows.length === 0) {
      return NextResponse.json(
        { error: "options required" },
        { status: 400 }
      );
    }

    const insertOptions = await adminClient
      .from("survey_options")
      .insert(optionRows);
    if (insertOptions.error) throw insertOptions.error;

    const accountIds = Array.isArray(body.accountIds)
      ? body.accountIds.map((id) => id.trim()).filter(Boolean)
      : [];
    if (accountIds.length === 0) {
      return NextResponse.json(
        { error: "accountIds required" },
        { status: 400 }
      );
    }

    const uniqueAccountIds = Array.from(new Set(accountIds));
    const targetRows = uniqueAccountIds.map((accountId) => ({
      survey_id: surveyId,
      account_id: accountId,
    }));
    const insertTargets = await adminClient
      .from("survey_targets")
      .insert(targetRows);
    if (insertTargets.error) throw insertTargets.error;

    return NextResponse.json({ id: surveyId });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "create failed") },
      { status: 500 }
    );
  }
}
