import { useEffect, useMemo, useState } from "react";
import { useAuthSession, useGoogleLogin, useLogout } from "../hooks/useAuth";
import { appConfig } from "../config/app";
import {
  ADMIN_HINT_TEXT,
  DAMAGE_FILTER_OPTIONS,
  getDashboardErrorMessage,
  ORIGIN_FILTER_OPTIONS,
} from "../constants/dashboard";
import { useCars, useSyncCars, useToggleFavorite } from "../hooks/useCars";
import type { InspectionConditionKey, SortDir, SortKey } from "../types/car";
import { compareByCaromotoPrice } from "../utils/caromoto";
import { formatDateTimeChisinau } from "../utils/dateTime";
import { fmtKm, fmtWon } from "../utils/format";
import CarTable from "./CarTable";
import GoogleLoginButton from "./GoogleLoginButton";
import NotificationsBell from "./NotificationsBell";
import RangeFilter from "./RangeFilter";
import StatsBar from "./StatsBar";

export default function Dashboard() {
  const googleClientId = appConfig.googleClientId;
  const { data: authSession } = useAuthSession();
  const googleLoginMutation = useGoogleLogin();
  const logoutMutation = useLogout();
  const { data, isPending, isError } = useCars();
  const toggleFavoriteMutation = useToggleFavorite();
  const syncCarsMutation = useSyncCars();

  const [errorToast, setErrorToast] = useState<string | null>(null);
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

  const currentUser = authSession?.user ?? null;
  const isAdmin = currentUser?.isAdmin === true;
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

  const formattedUpdatedAt = useMemo(() => {
    const updatedAt = data?.updatedAt;
    if (!updatedAt) return null;
    return formatDateTimeChisinau(updatedAt);
  }, [data?.updatedAt]);

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

  useEffect(() => {
    if (!isError) return;
    setErrorToast("Не удалось загрузить данные с backend API");
  }, [isError]);

  useEffect(() => {
    if (!errorToast) return;
    const timer = window.setTimeout(() => setErrorToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [errorToast]);

  const readyForFilters = useMemo(
    () => limits.maxYear > 0 && limits.maxMileage >= 0 && limits.maxPriceWon >= 0,
    [limits.maxYear, limits.maxMileage, limits.maxPriceWon],
  );

  const filtered = useMemo(() => {
    return cars.filter((car) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const qDigits = q.replace(/\D/g, "");
        const textFields = [String(car.year), String(car.mileageKm), car.modifiedDate];
        const numberFields = [String(car.price), String(car.priceWon)];

        const byText = textFields.some((value) => value.toLowerCase().includes(q));
        const byDigits =
          qDigits.length > 0 &&
          numberFields.some((value) => value.replace(/\D/g, "").includes(qDigits));

        if (!byText && !byDigits) return false;
      }

      if (car.year < yearRange[0] || car.year > yearRange[1]) return false;
      if (car.mileageKm < mileRange[0] || car.mileageKm > mileRange[1]) return false;
      if (car.priceWon < priceRange[0] || car.priceWon > priceRange[1]) return false;
      if (originFilter !== "all" && car.origin !== originFilter) return false;

      if (damageFilter !== "all") {
        const condition = conditionByCarId.get(car.id);
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

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

    const targetCar = cars.find(
      (car) => (car.origin ?? "encar") === origin && car.sourceId === sourceId,
    );
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

  function handleGoogleCredential(credential: string) {
    setErrorToast(null);
    googleLoginMutation.mutate(credential, {
      onError: (error) => setErrorToast(getDashboardErrorMessage(error)),
    });
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onError: (error) => setErrorToast(getDashboardErrorMessage(error)),
    });
  }

  function handleSync() {
    setErrorToast(null);
    syncCarsMutation.mutate(undefined, {
      onError: (error) => setErrorToast(getDashboardErrorMessage(error)),
    });
  }

  function handleToggleFavorite(id: number, isFavorite: boolean) {
    if (!isAdmin) {
      setErrorToast("Только администратор может менять избранное");
      return;
    }

    toggleFavoriteMutation.mutate(
      { id, isFavorite },
      {
        onError: (error) => setErrorToast(getDashboardErrorMessage(error)),
      },
    );
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
      {errorToast && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
          {errorToast}
        </div>
      )}

      <div className="mx-auto max-w-[1680px] px-3 py-2 sm:px-4 sm:py-4 xl:px-5 xl:py-6">
        <div className="mb-6 sm:mb-7">
          <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="whitespace-nowrap text-[1.85rem] font-semibold leading-none tracking-tight text-slate-800 sm:text-2xl">
                Audi A3 - подбор
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                База объявлений с фильтрами и сортировкой
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:items-center sm:gap-3">
              {currentUser ? (
                <div className="flex h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:flex-none">
                  {currentUser.picture ? (
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      className="h-7 w-7 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      {currentUser.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-none text-slate-700">
                      {currentUser.name}
                    </div>
                    <div className="hidden truncate text-[11px] text-slate-400 sm:block">
                      {currentUser.email}
                      {isAdmin ? " · admin" : ""}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className="h-8 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {logoutMutation.isPending ? "..." : "Выйти"}
                  </button>
                </div>
              ) : googleClientId ? (
                <div className="flex min-w-0 flex-1 items-center sm:flex-none">
                  <GoogleLoginButton
                    clientId={googleClientId}
                    disabled={googleLoginMutation.isPending}
                    onCredential={handleGoogleCredential}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Укажите VITE_GOOGLE_CLIENT_ID
                </div>
              )}

              <NotificationsBell onNavigateToCar={handleNavigateToCar} />
            </div>
          </div>

          {!isAdmin && (
            <p className="text-xs text-slate-400 sm:text-right">{ADMIN_HINT_TEXT}</p>
          )}
        </div>

        <div className="mb-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-5 sm:p-5">
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
                ×
              </button>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <StatsBar cars={tabFilteredCars} total={activeTotal} />

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
              {formattedUpdatedAt && (
                <span className="text-xs font-light text-slate-400 sm:text-right">
                  Последнее обновление: {formattedUpdatedAt}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={!isAdmin || syncCarsMutation.isPending}
                title={isAdmin ? "Запустить обновление" : "Только администратор может обновлять"}
                aria-label={syncCarsMutation.isPending ? "Обновление данных" : "Обновить"}
                className={`relative flex w-full min-w-[104px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-1.5 ${
                  syncCarsMutation.isPending ? "text-transparent" : ""
                }`}
              >
                {syncCarsMutation.isPending && (
                  <span className="absolute h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
                )}
                {syncCarsMutation.isPending ? "Обновление..." : "Обновить"}
              </button>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="text-left text-xs text-blue-500 underline underline-offset-2 transition-colors hover:text-blue-700 sm:text-right"
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
            canManageFavorites={isAdmin}
            onSort={handleSort}
            onSelectRow={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Audi A3 · {activeTotal} объявлений
        </p>
      </div>
    </div>
  );
}
