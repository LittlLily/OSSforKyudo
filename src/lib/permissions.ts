export const SUB_PERMISSIONS = [
  "survey_admin",
  "bow_admin",
  "invoice_admin",
  "calendar_admin",
] as const;

export type SubPermission = (typeof SUB_PERMISSIONS)[number];

export const SUB_PERMISSION_LABELS: Record<SubPermission, string> = {
  survey_admin: "アンケート",
  bow_admin: "弓管理",
  invoice_admin: "請求",
  calendar_admin: "カレンダー",
};

export function normalizeSubPermissions(value: unknown): SubPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is SubPermission =>
      typeof entry === "string" &&
      (SUB_PERMISSIONS as readonly string[]).includes(entry)
  );
}

export function hasSubPermission(
  list: string[] | null | undefined,
  permission: SubPermission
): boolean {
  return Array.isArray(list) && list.includes(permission);
}
