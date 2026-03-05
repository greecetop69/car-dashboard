import type { Car } from "../../types/car";
import { fmtWon } from "../../utils/format";

interface Props {
  car: Car | null;
  onClose: () => void;
}

export default function PriceHistoryModal({ car, onClose }: Props) {
  if (!car) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center md:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[82vh] w-full overflow-auto rounded-t-2xl bg-white p-4 shadow-xl md:max-h-[90vh] md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">История цены (₩)</h3>
          <button
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Текущая цена</div>
          <div className="text-lg font-semibold text-slate-800">{fmtWon(car.priceWon)}</div>
        </div>

        <div className="space-y-2">
          {history.length === 0 && (
            <div className="text-sm text-slate-500">Нет истории изменений</div>
          )}
          {history.map((item, idx) => (
            <div
              key={`${item.recordedAt}-${idx}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
            >
              <span className="text-xs text-slate-500">
                {new Date(item.recordedAt).toLocaleString("ru-RU")}
              </span>
              <span className="font-semibold text-slate-800">{fmtWon(item.priceWon)}</span>
            </div>
          ))}
        </div>

        {changeRows.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Изменения
            </div>
            <div className="space-y-2">
              {changeRows.map((item, idx) => {
                const up = item.diff > 0;
                return (
                  <div
                    key={`${item.recordedAt}-diff-${idx}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-500">
                      {new Date(item.recordedAt).toLocaleString("ru-RU")}
                    </span>
                    <span
                      className={
                        up ? "font-semibold text-red-600" : "font-semibold text-emerald-600"
                      }
                    >
                      {up ? "+" : "-"}
                      {fmtWon(Math.abs(item.diff))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
