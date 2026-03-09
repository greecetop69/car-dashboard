import { useEffect, useMemo, useState } from "react";
import { useCars, useSyncCars, useToggleFavorite } from "../hooks/useCars";
import type { InspectionConditionKey, SortDir, SortKey } from "../types/car";
import { compareByCaromotoPrice } from "../utils/caromoto";
import { fmtKm, fmtWon } from "../utils/format";
import CarTable from "./CarTable";
import NotificationsBell from "./NotificationsBell";
import RangeFilter from "./RangeFilter";
import StatsBar from "./StatsBar";

const DAMAGE_FILTER_OPTIONS: Array<{
  key: "all" | InspectionConditionKey;
  label: string;
  activeClass: string;
}> = [
  { key: "all", label: "Все", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "clean", label: "Не бита", activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { key: "repair", label: "Бита (ремонт)", activeClass: "border-amber-300 bg-amber-50 text-amber-700" },
  { key: "replace", label: "Бита (замена)", activeClass: "border-orange-300 bg-orange-50 text-orange-700" },
  {
    key: "replaceRepair",
    label: "Бита (замена + ремонт)",
    activeClass: "border-red-300 bg-red-50 text-red-700",
  },
  { key: "notFound", label: "Нет отчета", activeClass: "border-slate-300 bg-slate-100 text-slate-700" },
];

const ORIGIN_FILTER_OPTIONS: Array<{
  key: "all" | "encar" | "kbcha" | "kcar";
  label: string;
  activeClass: string;
}> = [
  { key: "all", label: "Все", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "encar", label: "ENCAR", activeClass: "border-red-300 bg-red-50 text-red-700" },
  { key: "kbcha", label: "KBCHA", activeClass: "border-amber-300 bg-amber-50 text-amber-800" },
  { key: "kcar", label: "KCAR", activeClass: "border-violet-300 bg-violet-50 text-violet-800" },
];

export default function Dashboard() {
  const { data, isPending, isError } = useCars();
  const toggleFavoriteMutation = useToggleFavorite();
  const syncCarsMutation = useSyncCars();

  const cars = data?.cars ?? [];
  const activeTotal = useMemo(
    () => cars.filter((car) => car.isActive !== false).length,
    [cars],
  );
  const priceWonLimits = useMemo(() => {
    if (cars.length === 0) return { min: 0, max: 0 };
    let min = cars[0].priceWon;
    let max = cars[0].priceWon;
    for (const car of cars) {
      if (car.priceWon < min) min = car.priceWon;
      if (car.priceWon > max) max = car.priceWon;
    }
    return { min, max };
  }, [cars]);
  const limits = {
    minYear: data?.meta?.minYear ?? 0,
    maxYear: data?.meta?.maxYear ?? 0,
    minMileage: data?.meta?.minMileage ?? 0,
    maxMileage: data?.meta?.maxMileage ?? 0,
    minPriceWon: priceWonLimits.min,
    maxPriceWon: priceWonLimits.max,
  };

  const [search, setSearch] = useState("");
  const [yearRange, setYearRange] = useState<[number, number]>([0, 0]);
  const [mileRange, setMileRange] = useState<[number, number]>([0, 0]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [damageFilter, setDamageFilter] = useState<"all" | InspectionConditionKey>("all");
  const [originFilter, setOriginFilter] = useState<"all" | "encar" | "kbcha" | "kcar">("all");
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const conditionByCarId = useMemo(() => {
    const map = new Map<number, InspectionConditionKey>();
    if (damageFilter === "all") return map;

    for (const car of cars) {
      if (!car.hasInspection) {
        map.set(car.id, "notFound");
        continue;
      }
      if (car.inspectionCondition) {
        map.set(car.id, car.inspectionCondition);
      }
    }

    return map;
  }, [cars, damageFilter]);

  useEffect(() => {
    setYearRange([limits.minYear, limits.maxYear]);
    setMileRange([limits.minMileage, limits.maxMileage]);
    setPriceRange([limits.minPriceWon, limits.maxPriceWon]);
  }, [
    limits.minYear,
    limits.maxYear,
    limits.minMileage,
    limits.maxMileage,
    limits.minPriceWon,
    limits.maxPriceWon,
  ]);

  const readyForFilters = useMemo(() => {
    return limits.maxYear > 0 && limits.maxMileage >= 0 && limits.maxPriceWon >= 0;
  }, [limits.maxYear, limits.maxMileage, limits.maxPriceWon]);

  const filtered = useMemo(() => {
    return cars.filter((c) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const qDigits = q.replace(/\D/g, "");
        const textFields = [String(c.year), String(c.mileageKm), c.modifiedDate];
        const numberFields = [String(c.price), String(c.priceWon)];

        const byText = textFields.some((v) => v.toLowerCase().includes(q));
        const byDigits =
          qDigits.length > 0 &&
          numberFields.some((v) => v.replace(/\D/g, "").includes(qDigits));

        if (!byText && !byDigits) return false;
      }
      if (c.year < yearRange[0] || c.year > yearRange[1]) return false;
      if (c.mileageKm < mileRange[0] || c.mileageKm > mileRange[1]) return false;
      if (c.priceWon < priceRange[0] || c.priceWon > priceRange[1]) return false;
      if (originFilter !== "all" && c.origin !== originFilter) return false;
      if (damageFilter !== "all") {
        const condition = conditionByCarId.get(c.id);
        if (!condition || condition !== damageFilter) return false;
      }
      return true;
    });
  }, [cars, search, yearRange, mileRange, priceRange, originFilter, damageFilter, conditionByCarId]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      if (sortKey === "caromotoPrice") {
        return compareByCaromotoPrice(a, b, sortDir);
      }
      if (sortKey === "sourceId") {
        const va = Number(a.sourceId ?? 0);
        const vb = Number(b.sourceId ?? 0);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }

      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const tabFilteredCars = useMemo(() => {
    if (activeTab === "favorites") {
      return sorted.filter((car) => car.isFavorite);
    }
    return sorted;
  }, [activeTab, sorted]);

  const activeSortedCount = useMemo(
    () => sorted.filter((car) => car.isActive !== false).length,
    [sorted],
  );
  const activeFavoriteSortedCount = useMemo(
    () => sorted.filter((car) => car.isFavorite && car.isActive !== false).length,
    [sorted],
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const hasFilters =
    search ||
    originFilter !== "all" ||
    damageFilter !== "all" ||
    yearRange[0] !== limits.minYear ||
    yearRange[1] !== limits.maxYear ||
    mileRange[0] !== limits.minMileage ||
    mileRange[1] !== limits.maxMileage ||
    priceRange[0] !== limits.minPriceWon ||
    priceRange[1] !== limits.maxPriceWon;

  function clearAll() {
    setSearch("");
    setOriginFilter("all");
    setDamageFilter("all");
    setYearRange([limits.minYear, limits.maxYear]);
    setMileRange([limits.minMileage, limits.maxMileage]);
    setPriceRange([limits.minPriceWon, limits.maxPriceWon]);
  }

  function scrollToCarElement(origin: "encar" | "kbcha" | "kcar", sourceId: string) {
    const selector = `[data-car-origin="${origin}"][data-car-source-id="${sourceId}"]`;
    const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const target = matches.find((node) => node.offsetParent !== null) ?? matches[0] ?? null;
    if (!target) return false;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-blue-400");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-blue-400");
    }, 1600);
    return true;
  }

  function handleNavigateToCar(origin: "encar" | "kbcha" | "kcar", sourceId: string) {
    setActiveTab("all");
    clearAll();

    const targetCar = cars.find((car) => (car.origin ?? "encar") === origin && car.sourceId === sourceId);
    if (targetCar) {
      setSelectedId(targetCar.id);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const foundNow = scrollToCarElement(origin, sourceId);
        if (!foundNow) {
          window.setTimeout(() => {
            scrollToCarElement(origin, sourceId);
          }, 220);
        }
      });
    });
  }

  if (isPending && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          <span className="text-sm text-slate-600">Загрузка машин...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1680px] px-3 py-6 md:px-4 md:py-8 xl:px-5 xl:py-10">
        <div className="mb-7">
          <div className="mb-1 flex items-center justify-between gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
              Audi A3 - подбор
            </h1>
            <NotificationsBell onNavigateToCar={handleNavigateToCar} />
          </div>
          <p className="ml-1 text-sm text-slate-400">
            База объявлений с фильтрами и сортировкой
          </p>
        </div>

        <div className="mb-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по году, пробегу, дате обновления..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-9 text-sm text-slate-700 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400 hover:text-slate-700"
              >
                x
              </button>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <RangeFilter
              label="Год"
              min={limits.minYear}
              max={limits.maxYear}
              value={yearRange}
              onChange={setYearRange}
              disabled={!readyForFilters}
            />
            <RangeFilter
              label="Пробег"
              min={limits.minMileage}
              max={limits.maxMileage}
              value={mileRange}
              onChange={setMileRange}
              format={fmtKm}
              disabled={!readyForFilters}
            />
            <RangeFilter
              label="Цена ₩"
              min={limits.minPriceWon}
              max={limits.maxPriceWon}
              value={priceRange}
              onChange={setPriceRange}
              format={fmtWon}
              disabled={!readyForFilters}
            />
          </div>

          <div className="h-px bg-slate-100" />

          <div className="flex flex-wrap items-center gap-2">
            {ORIGIN_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setOriginFilter(option.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  originFilter === option.key
                    ? option.activeClass
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="h-px bg-slate-100" />

          <div className="flex flex-wrap items-center gap-2">
            {DAMAGE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setDamageFilter(option.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  damageFilter === option.key
                    ? option.activeClass
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatsBar cars={tabFilteredCars} total={activeTotal} />
            <div className="flex items-center gap-3">
              <button
                onClick={() => syncCarsMutation.mutate()}
                disabled={syncCarsMutation.isPending}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncCarsMutation.isPending ? "Обновление..." : "Обновить"}
              </button>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-500 underline underline-offset-2 transition-colors hover:text-blue-700"
                >
                  Сбросить все фильтры
                </button>
              )}
            </div>
          </div>
        </div>

        {isPending && (
          <div className="px-1 pb-3 text-sm text-slate-500">
            Загрузка данных с backend...
          </div>
        )}
        {isError && (
          <div className="px-1 pb-3 text-sm text-red-600">
            Не удалось загрузить данные с backend API
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                activeTab === "all"
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Все ({activeSortedCount})
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                activeTab === "favorites"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Избранное ({activeFavoriteSortedCount})
            </button>
          </div>
          <CarTable
            cars={tabFilteredCars}
            sortKey={sortKey}
            sortDir={sortDir}
            selectedId={selectedId}
            isFavoritesView={activeTab === "favorites"}
            onSort={handleSort}
            onSelectRow={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            onToggleFavorite={(id, isFavorite) =>
              toggleFavoriteMutation.mutate({ id, isFavorite })
            }
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Audi A3 · {activeTotal} объявлений
        </p>
      </div>
    </div>
  );
}



