import { useState } from "react";
import type { SortKey, SortDir } from "../types/car";
import {
    MIN_YEAR,
    MAX_YEAR,
    MIN_MILE,
    MAX_MILE,
    MIN_PRICE,
    MAX_PRICE,
} from "../data/cars";
import { fmtEur, fmtKm } from "../utils/format";
import RangeFilter from "./RangeFilter";
import CarTable from "./CarTable";
import StatsBar from "./StatsBar";
import { CARS } from "../data/cars";

export default function Dashboard() {
    // ── Фильтры ───────────────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [yearRange, setYearRange] = useState<[number, number]>([
        MIN_YEAR,
        MAX_YEAR,
    ]);
    const [mileRange, setMileRange] = useState<[number, number]>([
        MIN_MILE,
        MAX_MILE,
    ]);
    const [priceRange, setPriceRange] = useState<[number, number]>([
        MIN_PRICE,
        MAX_PRICE,
    ]);

    // ── Сортировка ────────────────────────────────────────────────────────────
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    // ── Выделение строки ──────────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // ── Фильтрация ────────────────────────────────────────────────────────────
    const filtered = CARS.filter((c) => {
        const q = search.toLowerCase();
        if (
            q &&
            ![
                String(c.year),
                String(c.mileageKm),
                c.badge,
                c.modifiedDate,
            ].some((v) => v.toLowerCase().includes(q))
        )
            return false;
        if (c.year < yearRange[0] || c.year > yearRange[1]) return false;
        if (c.mileageKm < mileRange[0] || c.mileageKm > mileRange[1])
            return false;
        if (c.price < priceRange[0] || c.price > priceRange[1]) return false;
        return true;
    });

    // ── Сортировка ────────────────────────────────────────────────────────────
    const sorted = sortKey
        ? [...filtered].sort((a, b) => {
              const va = a[sortKey],
                  vb = b[sortKey];
              const cmp = va < vb ? -1 : va > vb ? 1 : 0;
              return sortDir === "asc" ? cmp : -cmp;
          })
        : filtered;

    function handleSort(key: SortKey) {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortDir("asc");
        }
    }

    // ── Сброс фильтров ────────────────────────────────────────────────────────
    const hasFilters =
        search ||
        yearRange[0] !== MIN_YEAR ||
        yearRange[1] !== MAX_YEAR ||
        mileRange[0] !== MIN_MILE ||
        mileRange[1] !== MAX_MILE ||
        priceRange[0] !== MIN_PRICE ||
        priceRange[1] !== MAX_PRICE;

    function clearAll() {
        setSearch("");
        setYearRange([MIN_YEAR, MAX_YEAR]);
        setMileRange([MIN_MILE, MAX_MILE]);
        setPriceRange([MIN_PRICE, MAX_PRICE]);
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 py-10">
                {/* Заголовок */}
                <div className="mb-7">
                    <div className="flex items-center gap-2.5 mb-1">
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                        >
                            <rect x="1" y="8" width="22" height="10" rx="2" />
                            <path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
                            <circle cx="7" cy="18" r="2" />
                            <circle cx="17" cy="18" r="2" />
                        </svg>
                        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
                            Audi A3 — подбор
                        </h1>
                    </div>
                    <p className="text-sm text-slate-400 ml-8">
                        База объявлений с фильтрами и сортировкой
                    </p>
                </div>

                {/* Фильтры */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4 space-y-5">
                    {/* Поиск */}
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Поиск по году, пробегу, комплектации…"
                            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition text-slate-700 placeholder-slate-400"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-lg leading-none"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Слайдеры */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <RangeFilter
                            label="Год"
                            min={MIN_YEAR}
                            max={MAX_YEAR}
                            value={yearRange}
                            onChange={setYearRange}
                        />
                        <RangeFilter
                            label="Пробег"
                            min={MIN_MILE}
                            max={MAX_MILE}
                            value={mileRange}
                            onChange={setMileRange}
                            format={fmtKm}
                        />
                        <RangeFilter
                            label="Цена €"
                            min={MIN_PRICE}
                            max={MAX_PRICE}
                            value={priceRange}
                            onChange={setPriceRange}
                            format={fmtEur}
                        />
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Статистика + сброс */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatsBar cars={sorted} total={CARS.length} />
                        {hasFilters && (
                            <button
                                onClick={clearAll}
                                className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors"
                            >
                                Сбросить все фильтры
                            </button>
                        )}
                    </div>
                </div>

                {/* Таблица */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <CarTable
                        cars={sorted}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        selectedId={selectedId}
                        onSort={handleSort}
                        onSelectRow={(id) =>
                            setSelectedId((prev) => (prev === id ? null : id))
                        }
                    />
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Audi A3 · {CARS.length} объявлений
                </p>
            </div>
        </div>
    );
}
