import type { Car } from "../types/car";
import { fmtEur, fmtKm } from "../utils/format";

interface Props {
    cars: Car[];
    total: number;
}

export default function StatsBar({ cars, total }: Props) {
    const activeCars = cars.filter((c) => c.isActive !== false);
    const n = activeCars.length;
    const avgPrice = n ? Math.round(activeCars.reduce((s, c) => s + c.price, 0) / n) : 0;
    const avgMile  = n ? Math.round(activeCars.reduce((s, c) => s + c.mileageKm, 0) / n) : 0;

    return (
        <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-mono">
            <span>
                <span className="text-slate-700 font-semibold">{n}</span> / {total} авто
            </span>
            {n > 0 && (
                <>
                    <span>ср. цена {fmtEur(avgPrice)}</span>
                    <span>ср. пробег {fmtKm(avgMile)}</span>
                </>
            )}
        </div>
    );
}
