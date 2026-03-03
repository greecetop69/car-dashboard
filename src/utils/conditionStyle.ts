import type { ConditionType } from "../types/car";

export const CONDITION_STYLE: Record<ConditionType, { bg: string; text: string }> = {
  "Не бита":              { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Бита (замена + ремонт)": { bg: "bg-red-50",    text: "text-red-700" },
  "Бита (замена)":        { bg: "bg-orange-50",  text: "text-orange-700" },
  "Бита (ремонт)":        { bg: "bg-yellow-50",  text: "text-yellow-700" },
  "Другое":               { bg: "bg-slate-100",  text: "text-slate-600" },
};
