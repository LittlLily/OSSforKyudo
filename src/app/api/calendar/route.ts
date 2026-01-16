import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  hasAdminOrSubPermission,
  requireUserWithSubPermissions,
} from "@/lib/permissions.server";

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

function parseDateParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

type CalendarEventPayload = {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
};

export async function GET(request: Request) {
  const auth = await requireUserWithSubPermissions();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const startDate = parseDateParam(startParam);
  const endDate = parseDateParam(endParam);

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start/end パラメータが必要です" },
      { status: 400 }
    );
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
    const rangeStartIso = startDate.toISOString();
    const rangeEndIso = endDate.toISOString();
    const response = await adminClient
      .from("calendar_events")
      .select(
        "id, title, description, starts_at, ends_at, all_day, created_by, created_at, updated_at"
      )
      .lte("starts_at", rangeEndIso)
      .gte("ends_at", rangeStartIso);

    if (response.error) throw response.error;

    return NextResponse.json({ events: response.data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "予定の読み込みに失敗しました") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireUserWithSubPermissions();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (!hasAdminOrSubPermission(auth, "calendar_admin")) {
    return NextResponse.json(
      { error: "権限がありません" },
      { status: 403 }
    );
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
    const body = (await request.json()) as CalendarEventPayload;
    const title = body.title?.trim() ?? "";
    if (!title) {
      return NextResponse.json(
        { error: "タイトルは必須です" },
        { status: 400 }
      );
    }

    const startsAt = parseDateParam(body.startsAt);
    const endsAt = parseDateParam(body.endsAt);
    if (!startsAt || !endsAt || endsAt < startsAt) {
      return NextResponse.json(
        { error: "開始/終了日時が不正です" },
        { status: 400 }
      );
    }

    const insertResponse = await adminClient
      .from("calendar_events")
      .insert({
        title,
        description: body.description?.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        all_day: Boolean(body.allDay),
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertResponse.error) throw insertResponse.error;

    return NextResponse.json({ id: insertResponse.data.id });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "予定の作成に失敗しました") },
      { status: 500 }
    );
  }
}
