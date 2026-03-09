import type { Car } from "../types/car";
import type { InspectionSummary } from "../types/inspection";

export type DamageConditionKey =
  | "clean"
  | "repair"
  | "replace"
  | "replaceRepair"
  | "notFound";

export function getInspectionIdCandidates(car: Car | null): number[] {
  if (!car) return [];
  if (car.origin === "kbcha" || car.origin === "kcar") return [];

  const fromPhoto = car.mainPhoto?.match(/\/(\d+)_\d+\.(?:jpg|jpeg|png)/i)?.[1];
  const fromUrl = car.url?.match(/\/detail\/(\d+)/)?.[1];
  const fromSource = car.sourceId;

  return [fromPhoto, fromUrl, fromSource]
    .map((value) => Number(value))
    .filter((id, idx, arr) => Number.isInteger(id) && id > 0 && arr.indexOf(id) === idx);
}

export function getDamageConditionKey(data: {
  notFound: boolean;
  damages: { statuses: string[] }[];
}): DamageConditionKey {
  if (data.notFound) return "notFound";

  const statusTexts = data.damages.flatMap((item) => item.statuses).map((s) => s.toLowerCase());
  const hasReplace = statusTexts.some((s) => s.includes("교환") || s.includes("교체"));
  const hasRepair = statusTexts.some((s) => s.includes("판금") || s.includes("용접") || s.includes("수리") || s.includes("도장"));

  if (hasReplace && hasRepair) return "replaceRepair";
  if (hasReplace) return "replace";
  if (hasRepair) return "repair";
  return "clean";
}

export function getDamageBadgeMeta(data: InspectionSummary): { label: string; className: string; key: DamageConditionKey } {
  const key = getDamageConditionKey(data);

  if (key === "notFound") {
    return {
      key,
      label: "нет отчета",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }
  if (key === "replaceRepair") {
    return {
      key,
      label: "бита (замена + ремонт)",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (key === "replace") {
    return {
      key,
      label: "бита (замена)",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  if (key === "repair") {
    return {
      key,
      label: "бита (ремонт)",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    key,
    label: "не бита",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}
