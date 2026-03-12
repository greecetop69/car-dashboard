import type { Car } from "../../types/car";
import { formatDateTimeChisinau } from "../../utils/dateTime";
import { fmtWon } from "../../utils/format";

export default function PriceTrendWon({ car }: { car: Car }) {
  const deltaWon = car.priceDeltaWon ?? 0;
  const trend = car.priceTrend ?? "same";
  const previousPriceWon = car.previousPriceWon ?? null;

  if (previousPriceWon == null) {
    return <div className="text-[11px] text-slate-400">нет истории</div>;
  }
  if (trend === "same") {
    return <div className="text-[11px] text-slate-400">без изменений</div>;
  }

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

      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-80 max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl group-hover:block">
        <div className="mb-2 text-sm font-semibold text-slate-700">История изменений (₩)</div>
        <div className="max-h-56 space-y-1.5 overflow-auto">
          {changeRows.length === 0 && (
            <div className="text-sm text-slate-500">Нет дополнительных изменений</div>
          )}
          {changeRows.map((item, idx) => {
            const up = item.diff > 0;
            return (
              <div
                key={`${item.recordedAt}-${idx}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0 text-slate-500">{formatDateTimeChisinau(item.recordedAt)}</span>
                <span className={up ? "shrink-0 font-semibold text-red-600" : "shrink-0 font-semibold text-emerald-600"}>
                  {up ? "+" : "-"}
                  {fmtWon(Math.abs(item.diff))}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          Было: {fmtWon(previousPriceWon)}
        </div>
      </div>
    </div>
  );
}
