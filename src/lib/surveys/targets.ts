import type { SupabaseClient } from "@supabase/supabase-js";

export type TargetField =
  | "display_name"
  | "student_number"
  | "generation"
  | "gender";

export type TargetOp = "ilike" | "eq";

export type TargetCondition = {
  field: TargetField;
  op: TargetOp;
  value: string;
};

export type TargetGroup = {
  id?: string;
  conditions: TargetCondition[];
};

export type ProfileTargetValues = {
  display_name?: string | null;
  student_number?: string | null;
  generation?: string | null;
  gender?: string | null;
};

const normalize = (value: string | null | undefined) =>
  (value ?? "").toLowerCase();

const matchesCondition = (
  profile: ProfileTargetValues,
  condition: TargetCondition
) => {
  const raw = profile[condition.field];
  if (!raw) return false;
  if (condition.op === "eq") {
    return normalize(raw) === normalize(condition.value);
  }
  return normalize(raw).includes(normalize(condition.value));
};

export const matchesAnyGroup = (
  profile: ProfileTargetValues,
  groups: TargetGroup[]
) => {
  if (!groups.length) return true;
  return groups.some((group) =>
    group.conditions.every((condition) => matchesCondition(profile, condition))
  );
};

export const resolveAccountIdsForTargetGroups = async (
  adminClient: SupabaseClient,
  groups: TargetGroup[]
) => {
  if (!groups.length) {
    const profilesResponse = await adminClient
      .from("profiles")
      .select("id");
    if (profilesResponse.error) throw profilesResponse.error;
    return (profilesResponse.data ?? []).map((profile) => profile.id as string);
  }

  const accountIds = new Set<string>();

  for (const group of groups) {
    let query = adminClient
      .from("profiles")
      .select("id, display_name, student_number, generation, gender");

    for (const condition of group.conditions) {
      if (condition.op === "ilike") {
        query = query.ilike(condition.field, `%${condition.value}%`);
      } else {
        query = query.eq(condition.field, condition.value);
      }
    }

    const response = await query;
    if (response.error) throw response.error;
    for (const profile of response.data ?? []) {
      accountIds.add(profile.id as string);
    }
  }

  return Array.from(accountIds);
};

export const resolveSurveyTargetAccountIds = async (
  adminClient: SupabaseClient,
  surveyId: string
) => {
  const response = await adminClient
    .from("survey_targets")
    .select("account_id")
    .eq("survey_id", surveyId);
  if (response.error) throw response.error;
  return (response.data ?? []).map((row) => row.account_id as string);
};
