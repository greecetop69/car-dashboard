import type { Car } from "../../types/car";

export default function DamageBadge({ car }: { car: Car }) {
  if (!car.hasInspection) {
    return <span className="text-slate-400">—</span>;
  }

  if (!car.inspectionCondition) {
    return (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        нет данных
      </span>
    );
  }

  const badgeByCondition: Record<
    NonNullable<Car["inspectionCondition"]>,
    { label: string; className: string }
  > = {
    notFound: {
      label: "нет отчета",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    },
    replaceRepair: {
      label: "бита (замена + ремонт)",
      className: "border-red-200 bg-red-50 text-red-700",
    },
    replace: {
      label: "бита (замена)",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    },
    repair: {
      label: "бита (ремонт)",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    clean: {
      label: "не бита",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  };

  const badge = badgeByCondition[car.inspectionCondition];
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  );
}
