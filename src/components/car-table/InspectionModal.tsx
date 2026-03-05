import { useInspection } from "../../hooks/useInspection";
import type { Car } from "../../types/car";
import { getInspectionIdCandidates } from "../../utils/inspectionCondition";

function useInspectionForCar(car: Car | null) {
  const ids = getInspectionIdCandidates(car);
  const primaryId = ids[0] ?? null;
  const fallbackIds = ids.slice(1);
  const query = useInspection(primaryId, fallbackIds, car?.id ?? null);
  return { ids, ...query };
}

export default function InspectionModal({
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
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Повреждения и осмотр</h3>
          <button
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        {isPending && <div className="text-sm text-slate-500">Загрузка inspection...</div>}
        {isError && <div className="text-sm text-red-600">Не удалось загрузить inspection-данные</div>}

        {data && (
          <div className="space-y-4">
            {data.notFound && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Для этого автомобиля inspection-отчет в Encar не найден (HTTP 404). Кандидаты
                vehicleId: {ids.join(", ")}
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
                  Авария: {String(data.accident)} · Ремонт: {String(data.simpleRepair)} · Утопление:{" "}
                  {String(data.waterlog)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-400">КПП</div>
                <div className="text-sm text-slate-800">{data.transmission ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">Кузовные повреждения / замены</div>
              {data.damages.length === 0 && (
                <div className="text-sm text-slate-500">Нет записей в outers</div>
              )}
              <div className="space-y-2">
                {data.damages.map((d, idx) => (
                  <div
                    key={`${d.part}-${idx}`}
                    className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
                  >
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
