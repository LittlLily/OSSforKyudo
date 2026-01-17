export type CalendarColorOption = {
  label: string;
  value: string | null;
};

export const CALENDAR_COLOR_OPTIONS: CalendarColorOption[] = [
  { label: "未指定", value: null },
  { label: "ミント", value: "#cfe8d8" },
  { label: "スカイ", value: "#cfe1f2" },
  { label: "ピンク", value: "#f2d2d7" },
  { label: "ラベンダー", value: "#e2d4f0" },
  { label: "サンド", value: "#f3e2c8" },
  { label: "グレー", value: "#d9dde3" },
];

export const CALENDAR_COLORS = CALENDAR_COLOR_OPTIONS.flatMap((option) =>
  option.value ? [option.value] : []
);

export const isCalendarColor = (value: string | null | undefined) =>
  value == null || CALENDAR_COLORS.includes(value);
