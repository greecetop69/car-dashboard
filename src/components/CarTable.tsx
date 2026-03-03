import type { Car, SortKey, SortDir } from "../types/car";
import { fmtEur, fmtKm, fmtWon } from "../utils/format";

interface Props {
    cars: Car[];
    sortKey: SortKey | null;
    sortDir: SortDir;
    selectedId: number | null;
    onSort: (key: SortKey) => void;
    onSelectRow: (id: number) => void;
}

const COLUMNS: { key: SortKey; label: string }[] = [
    { key: "year", label: "Год" },
    { key: "mileageKm", label: "Пробег" },
    { key: "price", label: "Цена €" },
    { key: "priceWon", label: "Цена ₩" },
];

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active)
        return <span className="ml-1 text-slate-300 text-[10px]">↕</span>;
    return (
        <span className="ml-1 text-blue-500 text-[10px]">
            {dir === "asc" ? "↑" : "↓"}
        </span>
    );
}

export default function CarTable({
    cars,
    sortKey,
    sortDir,
    selectedId,
    onSort,
    onSelectRow,
}: Props) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            Фото
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            Комплектация
                        </th>
                        {COLUMNS.map((col) => (
                            <th
                                key={col.key}
                                onClick={() => onSort(col.key)}
                                className={`px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap transition-colors ${
                                    sortKey === col.key
                                        ? "text-blue-600"
                                        : "text-slate-400 hover:text-slate-700"
                                }`}
                            >
                                {col.label}
                                <SortArrow
                                    active={sortKey === col.key}
                                    dir={sortDir}
                                />
                            </th>
                        ))}
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            Обновлено
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            Инспекция
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            Ссылка
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {cars.length === 0 && (
                        <tr>
                            <td
                                colSpan={7}
                                className="text-center py-20 text-slate-400 text-sm"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <svg
                                        width="36"
                                        height="36"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="text-slate-300"
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                    Ничего не найдено
                                </div>
                            </td>
                        </tr>
                    )}

                    {cars.map((car, i) => {
                        const isSelected = selectedId === car.id;
                        const isEven = i % 2 === 0;

                        return (
                            <tr
                                key={car.id}
                                onClick={() => onSelectRow(car.id)}
                                className={`border-b border-slate-100 cursor-pointer transition-colors ${
                                    isSelected
                                        ? "bg-blue-50"
                                        : isEven
                                          ? "bg-white hover:bg-slate-50"
                                          : "bg-slate-50/50 hover:bg-slate-100/70"
                                }`}
                            >
                                {/* Фото */}
                                <td className="px-4 py-2 whitespace-nowrap">
                                    {car.mainPhoto ? (
                                        <img
                                            src={car.mainPhoto}
                                            alt="Фото"
                                            className="w-20 h-14 object-cover rounded-lg border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-20 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-300 text-xs">
                                            нет фото
                                        </div>
                                    )}
                                </td>

                                {/* Комплектация */}
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-medium">
                                    {car.badge || "—"}
                                </td>

                                {/* Год */}
                                <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                                    {car.year}
                                </td>

                                {/* Пробег */}
                                <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                                    {fmtKm(car.mileageKm)}
                                </td>

                                {/* Цена EUR */}
                                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                                    {fmtEur(car.price)}
                                </td>

                                {/* Цена Won */}
                                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                                    {fmtWon(car.priceWon)}
                                </td>

                                {/* Дата обновления */}
                                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                    {car.modifiedDate}
                                </td>

                                {/* Инспекция */}
                                <td className="px-4 py-3">
                                    {car.hasInspection ? (
                                        <div className="flex items-center justify-center gap-1 min-h-[2.5rem]">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(
                                                        car.diagnosisUrl,
                                                        "_blank",
                                                        "noopener,noreferrer",
                                                    );
                                                }}
                                                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                                                title="Диагностика"
                                            >
                                                🩺
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(
                                                        car.inspectionUrl,
                                                        "_blank",
                                                        "noopener,noreferrer",
                                                    );
                                                }}
                                                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-colors"
                                                title="Инспекция"
                                            >
                                                🔍
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(
                                                        car.accidentUrl,
                                                        "_blank",
                                                        "noopener,noreferrer",
                                                    );
                                                }}
                                                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                                                title="Аварии"
                                            >
                                                💥
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-400 min-h-[2.5rem] flex items-center justify-center">
                                            —
                                        </div>
                                    )}
                                </td>

                                {/* Ссылка */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(
                                                car.url,
                                                "_blank",
                                                "noopener,noreferrer",
                                            );
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-blue-600 text-xs font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                    >
                                        <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                        >
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line
                                                x1="10"
                                                y1="14"
                                                x2="21"
                                                y2="3"
                                            />
                                        </svg>
                                        Открыть
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
