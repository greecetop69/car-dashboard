import type { Car } from "../types/car";
import { fmtEur, fmtKm } from "../utils/format";

interface Props {
  cars: Car[];
  total: number;
}

export default function StatsBar({ cars, total }: Props) {
  const activeCars = cars.filter((car) => car.isActive !== false);
  const count = activeCars.length;
  const avgPrice = count
    ? Math.round(activeCars.reduce((sum, car) => sum + car.price, 0) / count)
    : 0;
  const avgMileage = count
    ? Math.round(activeCars.reduce((sum, car) => sum + car.mileageKm, 0) / count)
    : 0;

  return (
    <div className="grid w-full grid-cols-1 gap-x-4 gap-y-2 font-mono text-xs text-slate-400 sm:flex sm:w-auto sm:flex-wrap sm:gap-4">
      <span>
        <span className="font-semibold text-slate-700">{count}</span> / {total} авто
      </span>
      {count > 0 && (
        <>
          <span>ср. цена {fmtEur(avgPrice)}</span>
          <span>ср. пробег {fmtKm(avgMileage)}</span>
        </>
      )}
    </div>
  );
}
