import { useState } from "react";
import { useInspection } from "../hooks/useInspection";
import type { Car, SortDir, SortKey } from "../types/car";
import { getCaromotoPriceEur } from "../utils/caromoto";
import { getDamageBadgeMeta, getInspectionIdCandidates } from "../utils/inspectionCondition";
import { fmtEur, fmtKm, fmtWon } from "../utils/format";

interface Props {
  cars: Car[];
  sortKey: SortKey | null;
  sortDir: SortDir;
  selectedId: number | null;
  onSort: (key: SortKey) => void;
  onSelectRow: (id: number) => void;
  onToggleFavorite: (id: number, isFavorite: boolean) => void;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "year", label: "Год" },
  { key: "mileageKm", label: "Пробег" },
  { key: "price", label: "Цена €" },
  { key: "priceWon", label: "Цена ₩" },
];

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-[10px] text-slate-300">↕</span>;
  return <span className="ml-1 text-[10px] text-blue-500">{dir === "asc" ? "↑" : "↓"}</span>;
}

function PriceTrendWon({ car }: { car: Car }) {
  const deltaWon = car.priceDeltaWon ?? 0;
  const trend = car.priceTrend ?? "same";
  const previousPriceWon = car.previousPriceWon ?? null;

  if (previousPriceWon == null) return <div className="text-[11px] text-slate-400">нет истории</div>;
  if (trend === "same") return <div className="text-[11px] text-slate-400">без изменений</div>;

  const isUp = trend === "up";
  const sign = isUp ? "+" : "-";
  const amount = fmtWon(Math.abs(deltaWon));
  const history = car.priceHistory ?? [];
  const changeRows = history
    .slice(0, -1)
    .map((current, idx) => {
      const previous = history[idx + 1];
      const diff = current.priceWon - previous.priceWon;
      return { recordedAt: current.recordedAt, diff };
    })
    .filter((item) => item.diff !== 0);

  return (
    <div className="group relative inline-flex">
      <div
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
          isUp ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
        }`}
      >
        <span>{isUp ? "↑" : "↓"}</span>
        <span>
          {sign}
          {amount}
        </span>
      </div>

      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-80 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl group-hover:block">
        <div className="mb-2 text-sm font-semibold text-slate-700">История изменений (₩)</div>
        <div className="max-h-56 space-y-1.5 overflow-auto">
          {changeRows.length === 0 && <div className="text-sm text-slate-500">Нет дополнительных изменений</div>}
          {changeRows.map((item, idx) => {
            const up = item.diff > 0;
            return (
              <div key={`${item.recordedAt}-${idx}`} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{new Date(item.recordedAt).toLocaleString("ru-RU")}</span>
                <span className={up ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                  {up ? "+" : "-"}
                  {fmtWon(Math.abs(item.diff))}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">Было: {fmtWon(previousPriceWon)}</div>
      </div>
    </div>
  );
}

function useInspectionForCar(car: Car | null) {
  const ids = getInspectionIdCandidates(car);
  const primaryId = ids[0] ?? null;
  const fallbackIds = ids.slice(1);
  const query = useInspection(primaryId, fallbackIds);
  return { ids, ...query };
}

function DamageBadge({ car }: { car: Car }) {
  const { data, isPending } = useInspectionForCar(car);

  if (!car.hasInspection) {
    return (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
        —
      </span>
    );
  }

  if (isPending) {
    return (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        проверка...
      </span>
    );
  }

  if (!data) {
    return (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        нет данных
      </span>
    );
  }

  const badge = getDamageBadgeMeta(data);
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function InspectionModal({
  car,
  onClose,
}: {
  car: Car | null;
  onClose: () => void;
}) {
  const { ids, data, isPending, isError } = useInspectionForCar(car);

  if (!car) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Повреждения и осмотр</h3>
          <button className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600" onClick={onClose}>
            Закрыть
          </button>
        </div>

        {isPending && <div className="text-sm text-slate-500">Загрузка inspection...</div>}
        {isError && <div className="text-sm text-red-600">Не удалось загрузить inspection-данные</div>}

        {data && (
          <div className="space-y-4">
            {data.notFound && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Для этого автомобиля inspection-отчет в Encar не найден (HTTP 404). Кандидаты vehicleId: {ids.join(", ")}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-400">VIN</div>
                <div className="font-mono text-sm text-slate-800">{data.vin ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-400">Год / Пробег</div>
                <div className="text-sm text-slate-800">
                  {data.modelYear ?? "—"} / {data.mileage ?? "—"} км
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-400">Флаги</div>
                <div className="text-sm text-slate-800">
                  Авария: {String(data.accident)} · Ремонт: {String(data.simpleRepair)} · Утопление: {String(data.waterlog)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-400">КПП</div>
                <div className="text-sm text-slate-800">{data.transmission ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">Кузовные повреждения / замены</div>
              {data.damages.length === 0 && <div className="text-sm text-slate-500">Нет записей в outers</div>}
              <div className="space-y-2">
                {data.damages.map((d, idx) => (
                  <div key={`${d.part}-${idx}`} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0">
                    <span className="min-w-[220px] font-medium text-slate-700">{d.part}</span>
                    <span className="text-slate-500">{d.statuses.join(", ") || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CarTable({
  cars,
  sortKey,
  sortDir,
  selectedId,
  onSort,
  onSelectRow,
  onToggleFavorite,
}: Props) {
  const [inspectionCar, setInspectionCar] = useState<Car | null>(null);

  return (
    <div className="w-full overflow-x-hidden">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="w-[180px] px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Фото</th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`cursor-pointer select-none whitespace-nowrap px-4 py-4 text-right text-xs font-semibold uppercase tracking-widest transition-colors ${
                  sortKey === col.key ? "text-blue-600" : "text-slate-400 hover:text-slate-700"
                } ${
                  col.key === "year"
                    ? "w-[90px]"
                    : col.key === "mileageKm"
                      ? "w-[210px]"
                      : col.key === "price"
                        ? "w-[170px]"
                        : "w-[210px]"
                }`}
              >
                {col.label}
                <SortArrow active={sortKey === col.key} dir={sortDir} />
              </th>
            ))}
            <th
              onClick={() => onSort("caromotoPrice")}
              className={`w-[190px] cursor-pointer select-none whitespace-nowrap px-4 py-4 text-right text-xs font-semibold uppercase tracking-widest transition-colors ${
                sortKey === "caromotoPrice" ? "text-blue-600" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              Caromoto Price €
              <SortArrow active={sortKey === "caromotoPrice"} dir={sortDir} />
            </th>
            <th className="w-[250px] px-3 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Обновлено</th>
            <th className="w-[220px] px-3 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Статус кузова</th>
            <th className="w-[168px] px-3 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Инспекция</th>
            <th className="w-[90px] px-3 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Избр.</th>
            <th className="w-[140px] px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Ссылка</th>
          </tr>
        </thead>
        <tbody>
          {cars.length === 0 && (
            <tr>
              <td colSpan={11} className="py-24 text-center text-base text-slate-400">
                Ничего не найдено
              </td>
            </tr>
          )}
          {cars.map((car, i) => {
            const isSelected = selectedId === car.id;
            const isEven = i % 2 === 0;
            const isInactive = car.isActive === false;
            const isNew = car.isNew === true;
            const mutedText = isInactive ? "text-slate-400" : "text-slate-700";
            const strongText = isInactive ? "text-slate-500" : "text-slate-800";
            const caromotoPrice = getCaromotoPriceEur(car);

            return (
              <tr
                key={car.id}
                onClick={() => {
                  if (!isInactive) onSelectRow(car.id);
                }}
                className={`border-b border-slate-100 transition-colors ${
                  isInactive
                    ? "bg-slate-200/70 opacity-55"
                    : isSelected
                      ? "cursor-pointer bg-blue-50"
                      : isEven
                        ? "cursor-pointer bg-white hover:bg-slate-50"
                        : "cursor-pointer bg-slate-50/50 hover:bg-slate-100/70"
                } ${isNew ? "ring-2 ring-inset ring-emerald-300/80" : ""}`}
              >
                <td className="whitespace-nowrap px-5 py-3">
                  <div className="relative inline-flex">
                    {car.mainPhoto ? (
                      <img
                        src={car.mainPhoto}
                        alt="Фото"
                        className="h-24 w-36 rounded-lg border border-slate-200 object-cover"
                        style={
                          isInactive
                            ? {
                                filter: "grayscale(100%) contrast(75%) brightness(75%) saturate(50%)",
                                opacity: 0.65,
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-300">
                        нет фото
                      </div>
                    )}
                    {isInactive && (
                      <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                        ПРОПАЛА
                      </span>
                    )}
                    {isNew && (
                      <span className="absolute right-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                        NEW
                      </span>
                    )}
                  </div>
                </td>
                <td className={`w-[90px] whitespace-nowrap px-4 py-4 text-right font-mono ${mutedText}`}>{car.year}</td>
                <td className={`w-[210px] whitespace-nowrap px-4 py-4 text-right font-mono ${mutedText}`}>{fmtKm(car.mileageKm)}</td>
                <td className={`w-[170px] whitespace-nowrap px-4 py-4 text-right font-mono font-semibold ${strongText}`}>{fmtEur(car.price)}</td>
                <td className={`w-[210px] whitespace-nowrap px-4 py-4 text-right font-mono font-semibold ${strongText}`}>
                  <div className="flex flex-col items-end gap-1">
                    <span>{fmtWon(car.priceWon)}</span>
                    <PriceTrendWon car={car} />
                  </div>
                </td>
                <td className={`w-[190px] whitespace-nowrap px-4 py-4 text-right font-mono font-semibold ${strongText}`}>
                  {caromotoPrice != null ? fmtEur(caromotoPrice) : "—"}
                </td>
                <td className={`w-[250px] whitespace-nowrap px-3 py-4 text-sm ${isInactive ? "text-slate-500" : "text-slate-400"}`}>{car.modifiedDate}</td>
                <td className="w-[220px] px-3 py-4">
                  <div className="flex min-h-[3rem] items-center">
                    <DamageBadge car={car} />
                  </div>
                </td>
                <td className="w-[168px] px-3 py-4">
                  <div className="flex min-h-[3rem] items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectionCar(car);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      title="Повреждения / VIN"
                    >
                      📋
                    </button>
                    {!isInactive && car.hasInspection ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(car.diagnosisUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          title="Диагностика"
                        >
                          🩺
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(car.inspectionUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                          title="Инспекция"
                        >
                          🔍
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(car.accidentUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          title="Аварии"
                        >
                          💥
                        </button>
                      </>
                    ) : (
                      <div className="text-slate-400">—</div>
                    )}
                  </div>
                </td>
                <td className="w-[90px] whitespace-nowrap px-3 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(car.id, !(car.isFavorite ?? false));
                    }}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-colors ${
                      car.isFavorite
                        ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100"
                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                    }`}
                    title={car.isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                  >
                    {car.isFavorite ? "★" : "☆"}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(car.url, "_blank", "noopener,noreferrer");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    Открыть
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <InspectionModal car={inspectionCar} onClose={() => setInspectionCar(null)} />
    </div>
  );
}
