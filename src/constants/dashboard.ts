import type { InspectionConditionKey } from "../types/car";

export const DAMAGE_FILTER_OPTIONS: Array<{
  key: "all" | InspectionConditionKey;
  label: string;
  activeClass: string;
}> = [
  { key: "all", label: "Все", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "clean", label: "Не бита", activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { key: "repair", label: "Бита (ремонт)", activeClass: "border-amber-300 bg-amber-50 text-amber-700" },
  { key: "replace", label: "Бита (замена)", activeClass: "border-orange-300 bg-orange-50 text-orange-700" },
  {
    key: "replaceRepair",
    label: "Бита (замена + ремонт)",
    activeClass: "border-red-300 bg-red-50 text-red-700",
  },
  { key: "notFound", label: "Нет отчета", activeClass: "border-slate-300 bg-slate-100 text-slate-700" },
];

export const ORIGIN_FILTER_OPTIONS: Array<{
  key: "all" | "encar" | "kbcha" | "kcar";
  label: string;
  activeClass: string;
}> = [
  { key: "all", label: "Все", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "encar", label: "ENCAR", activeClass: "border-red-300 bg-red-50 text-red-700" },
  { key: "kbcha", label: "KBCHA", activeClass: "border-amber-300 bg-amber-50 text-amber-800" },
  { key: "kcar", label: "KCAR", activeClass: "border-violet-300 bg-violet-50 text-violet-800" },
];

export const ADMIN_HINT_TEXT = "Обновление и избранное доступны только администратору";
export const DEFAULT_REQUEST_ERROR_MESSAGE = "Запрос не выполнен";

export function getDashboardErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim().length > 0) {
      return maybe.message;
    }
  }
  return DEFAULT_REQUEST_ERROR_MESSAGE;
}
