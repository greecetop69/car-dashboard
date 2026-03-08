import { useState } from "react";
import type { Car, SortDir, SortKey } from "../types/car";
import { getCaromotoPriceEur } from "../utils/caromoto";
import { fmtEur, fmtKm, fmtWon } from "../utils/format";
import DamageBadge from "./car-table/DamageBadge";
import InspectionModal from "./car-table/InspectionModal";
import CarPhoto from "./car-table/CarPhoto";
import PriceHistoryModal from "./car-table/PriceHistoryModal";
import PriceTrendWon from "./car-table/PriceTrendWon";
import SortArrow from "./car-table/SortArrow";
import Button from "./ui/Button";
import FavoriteButton from "./ui/FavoriteButton";
import OpenExternalLink from "./ui/OpenExternalLink";

interface Props {
    cars: Car[];
    sortKey: SortKey | null;
    sortDir: SortDir;
    selectedId: number | null;
    isFavoritesView?: boolean;
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

const MOBILE_DETAIL_BUTTON_CLASS =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600";
const MOBILE_OPEN_LINK_CLASS =
    "inline-block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 hover:border-blue-300 text-center";
const TABLE_OPEN_LINK_CLASS =
    "inline-block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 hover:border-blue-300 text-center";
const INSPECTION_ACTIONS_CLASS = "flex min-h-[3rem] items-center justify-center gap-2";
const INSPECTION_ICON_BUTTON_BASE =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors";
const CENTERED_DASH_CLASS = "flex min-h-[3rem] items-center justify-center text-slate-400";

export default function CarTable({
    cars,
    sortKey,
    sortDir,
    selectedId,
    isFavoritesView = false,
    onSort,
    onSelectRow,
    onToggleFavorite,
}: Props) {
    const [inspectionCar, setInspectionCar] = useState<Car | null>(null);
    const [priceHistoryCar, setPriceHistoryCar] = useState<Car | null>(null);
    const getOriginBadge = (origin: Car["origin"]) =>
        origin === "kbcha"
            ? { label: "KBCHA", className: "bg-amber-300 text-amber-950" }
            : { label: "ENCAR", className: "bg-red-600 text-white" };

    return (
        <div className="w-full">
            <div className="space-y-3 p-3 md:hidden">
                {cars.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                        Ничего не найдено
                    </div>
                )}
                {cars.map((car) => {
                    const isInactive = car.isActive === false;
                    const isNew = car.isNew === true;
                    const isSelected = selectedId === car.id;
                    const caromotoPrice = getCaromotoPriceEur(car);
                    const originBadge = getOriginBadge(car.origin);
                    const carOrigin = car.origin ?? "encar";
                    const carSourceId = car.sourceId ?? "";
                    const mobilePhotoClass = isFavoritesView
                        ? "h-24 w-36"
                        : "h-24 w-32";
                    const showMobileDetails = car.origin !== "kbcha";
                    const wonTrend = car.priceTrend ?? "same";
                    const wonTrendClass =
                        wonTrend === "up"
                            ? "text-red-600"
                            : wonTrend === "down"
                              ? "text-emerald-600"
                              : "text-slate-700";

                    return (
                        <div
                            key={car.id}
                            data-car-origin={carOrigin}
                            data-car-source-id={carSourceId}
                            onClick={() => {
                                if (!isInactive) onSelectRow(car.id);
                            }}
                            className={`rounded-2xl border bg-white p-3 shadow-sm transition-colors ${
                                isInactive
                                    ? "border-slate-200 bg-slate-100/70 opacity-70"
                                    : isSelected
                                      ? "border-blue-300 bg-blue-50"
                                      : "border-slate-200"
                            } ${isNew ? "ring-2 ring-emerald-300/80" : ""}`}
                        >
                            <div className="mb-3 flex gap-3">
                                <div className="relative shrink-0">
                                    {car.mainPhoto ? (
                                        <CarPhoto
                                            src={car.mainPhoto}
                                            alt="Фото"
                                            className={mobilePhotoClass}
                                            inactive={isInactive}
                                        />
                                    ) : (
                                        <div
                                            className={`flex ${mobilePhotoClass} items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-400`}
                                        >
                                            нет фото
                                        </div>
                                    )}
                                    {isInactive && (
                                        <span className="absolute left-2 top-2 rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                                            КУПЛЕНА
                                        </span>
                                    )}
                                    {isNew && (
                                        <span className="absolute right-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                                            NEW
                                        </span>
                                    )}
                                    <span
                                        className={`absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${originBadge.className}`}
                                    >
                                        {originBadge.label}
                                    </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-start justify-between gap-2">
                                        <div className="text-sm font-semibold text-slate-800">
                                            {car.year}
                                        </div>
                                        <FavoriteButton
                                            active={Boolean(car.isFavorite)}
                                            size="sm"
                                            onToggle={() =>
                                                onToggleFavorite(
                                                    car.id,
                                                    !(car.isFavorite ?? false),
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {fmtKm(car.mileageKm)}
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-slate-800">
                                        {fmtEur(car.price)}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPriceHistoryCar(car);
                                        }}
                                        className={`inline-flex items-center gap-1 text-sm font-semibold ${wonTrendClass}`}
                                    >
                                        <span>{fmtWon(car.priceWon)}</span>
                                        {wonTrend === "up" && <span>↑</span>}
                                        {wonTrend === "down" && <span>↓</span>}
                                    </button>
                                    <div className="mt-1 text-xs text-slate-400">
                                        {car.modifiedDate}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3 flex items-center justify-between gap-2">
                                <DamageBadge car={car} />
                                <div className="text-xs font-medium text-slate-500">
                                    Caromoto:{" "}
                                    {caromotoPrice != null
                                        ? fmtEur(caromotoPrice)
                                        : "—"}
                                </div>
                            </div>

                            <div className={`grid gap-2 ${showMobileDetails ? "grid-cols-2" : "grid-cols-1"}`}>
                                {showMobileDetails && (
                                    <Button
                                        onClick={() => setInspectionCar(car)}
                                        className={MOBILE_DETAIL_BUTTON_CLASS}
                                    >
                                        Детали
                                    </Button>
                                )}
                                <OpenExternalLink
                                    href={car.url}
                                    className={MOBILE_OPEN_LINK_CLASS}
                                >
                                    Открыть
                                </OpenExternalLink>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1640px] border-collapse text-sm xl:text-base [&_th]:px-2 [&_td]:px-2 xl:[&_th]:px-3 xl:[&_td]:px-3">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="w-[180px] py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Фото
                        </th>
                        <th
                            onClick={() => onSort("sourceId")}
                            className={`w-[90px] cursor-pointer select-none whitespace-nowrap py-4 text-right text-xs font-semibold uppercase tracking-widest transition-colors ${
                                sortKey === "sourceId"
                                    ? "text-blue-600"
                                    : "text-slate-400 hover:text-slate-700"
                            }`}
                        >
                            ID
                            <SortArrow
                                active={sortKey === "sourceId"}
                                dir={sortDir}
                            />
                        </th>
                        {COLUMNS.map((col) => (
                            <th
                                key={col.key}
                                onClick={() => onSort(col.key)}
                                className={`cursor-pointer select-none whitespace-nowrap py-4 text-right text-xs font-semibold uppercase tracking-widest transition-colors ${
                                    sortKey === col.key
                                        ? "text-blue-600"
                                        : "text-slate-400 hover:text-slate-700"
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
                                <SortArrow
                                    active={sortKey === col.key}
                                    dir={sortDir}
                                />
                            </th>
                        ))}
                        <th
                            onClick={() => onSort("caromotoPrice")}
                            className={`w-[190px] cursor-pointer select-none whitespace-nowrap py-4 text-right text-xs font-semibold uppercase tracking-widest transition-colors ${
                                sortKey === "caromotoPrice"
                                    ? "text-blue-600"
                                    : "text-slate-400 hover:text-slate-700"
                            }`}
                        >
                            Caromoto Price €
                            <SortArrow
                                active={sortKey === "caromotoPrice"}
                                dir={sortDir}
                            />
                        </th>
                        <th className="w-[160px] py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Обновлено
                        </th>
                        <th className="w-[220px] py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Статус кузова
                        </th>
                        <th className="w-[168px] py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Инспекция
                        </th>
                        <th className="w-[90px] py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Избр.
                        </th>
                        <th className="w-[140px] py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Ссылка
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {cars.length === 0 && (
                        <tr>
                            <td
                                colSpan={12}
                                className="py-24 text-center text-base text-slate-400"
                            >
                                Ничего не найдено
                            </td>
                        </tr>
                    )}
                    {cars.map((car, i) => {
                        const isSelected = selectedId === car.id;
                        const isEven = i % 2 === 0;
                        const isInactive = car.isActive === false;
                        const isNew = car.isNew === true;
                        const carOrigin = car.origin ?? "encar";
                        const carSourceId = car.sourceId ?? "";
                        const mutedText = isInactive
                            ? "text-slate-400"
                            : "text-slate-700";
                        const strongText = isInactive
                            ? "text-slate-500"
                            : "text-slate-800";
                        const caromotoPrice = getCaromotoPriceEur(car);
                        const originBadge = getOriginBadge(car.origin);

                        return (
                            <tr
                                key={car.id}
                                data-car-origin={carOrigin}
                                data-car-source-id={carSourceId}
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
                                <td className="whitespace-nowrap py-3">
                                    <div className="relative h-24 w-40">
                                        <CarPhoto
                                            src={car.mainPhoto}
                                            alt="Фото"
                                            className="h-24 w-40"
                                            inactive={isInactive}
                                        />

                                        {isInactive && (
                                            <span className="absolute left-2 top-2 rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                                                КУПЛЕНА
                                            </span>
                                        )}
                                        {isNew && (
                                            <span className="absolute right-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                                                NEW
                                            </span>
                                        )}
                                        <span
                                            className={`absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-sm ${originBadge.className}`}
                                        >
                                            {originBadge.label}
                                        </span>
                                    </div>
                                </td>
                                <td
                                    className={`w-[90px] whitespace-nowrap py-4 text-right font-mono ${mutedText}`}
                                >
                                    {car.sourceId ?? "—"}
                                </td>
                                <td
                                    className={`w-[90px] whitespace-nowrap py-4 text-right font-mono ${mutedText}`}
                                >
                                    {car.year}
                                </td>
                                <td
                                    className={`w-[210px] whitespace-nowrap py-4 text-right font-mono ${mutedText}`}
                                >
                                    {fmtKm(car.mileageKm)}
                                </td>
                                <td
                                    className={`w-[170px] whitespace-nowrap py-4 text-right font-mono font-semibold ${strongText}`}
                                >
                                    {fmtEur(car.price)}
                                </td>
                                <td
                                    className={`w-[210px] whitespace-nowrap py-4 text-right font-mono font-semibold ${strongText}`}
                                >
                                    <div className="flex flex-col items-end gap-1">
                                        <span>{fmtWon(car.priceWon)}</span>
                                        <PriceTrendWon car={car} />
                                    </div>
                                </td>
                                <td
                                    className={`w-[190px] whitespace-nowrap py-4 text-right font-mono font-semibold ${strongText}`}
                                >
                                    {caromotoPrice != null
                                        ? fmtEur(caromotoPrice)
                                        : "—"}
                                </td>
                                <td
                                    className={`w-[160px] py-4 text-sm ${isInactive ? "text-slate-500" : "text-slate-400"}`}
                                >
                                    <div className="flex flex-col items-start gap-1">
                                        <span>{car.modifiedDate}</span>
                                        {isInactive && (
                                            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700">
                                                КУПЛЕНА
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="w-[220px] py-4">
                                    <div
                                        className={`flex min-h-[3rem] items-center ${
                                            !car.hasInspection ? "justify-center" : ""
                                        }`}
                                    >
                                        <DamageBadge car={car} />
                                    </div>
                                </td>
                                <td className="w-[168px] py-4">
                                    {car.origin === "kbcha" ? (
                                        <div className={CENTERED_DASH_CLASS}>—</div>
                                    ) : (
                                        <div className={INSPECTION_ACTIONS_CLASS}>
                                            <Button
                                                onClick={() => setInspectionCar(car)}
                                                className={`${INSPECTION_ICON_BUTTON_BASE} hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700`}
                                                title="Повреждения / VIN"
                                            >
                                                📋
                                            </Button>
                                            {!isInactive && car.hasInspection ? (
                                                <>
                                                    <OpenExternalLink
                                                        href={car.diagnosisUrl}
                                                        className={`${INSPECTION_ICON_BUTTON_BASE} hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600`}
                                                    >
                                                        🩺
                                                    </OpenExternalLink>
                                                    <OpenExternalLink
                                                        href={car.inspectionUrl}
                                                        className={`${INSPECTION_ICON_BUTTON_BASE} hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600`}
                                                    >
                                                        🔍
                                                    </OpenExternalLink>
                                                    <OpenExternalLink
                                                        href={car.accidentUrl}
                                                        className={`${INSPECTION_ICON_BUTTON_BASE} hover:border-red-300 hover:bg-red-50 hover:text-red-600`}
                                                    >
                                                        💥
                                                    </OpenExternalLink>
                                                </>
                                            ) : (
                                                <div className={CENTERED_DASH_CLASS}>—</div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="w-[90px] whitespace-nowrap py-4">
                                    <FavoriteButton
                                        active={Boolean(car.isFavorite)}
                                        onToggle={() =>
                                            onToggleFavorite(
                                                car.id,
                                                !(car.isFavorite ?? false),
                                            )
                                        }
                                    />
                                </td>
                                <td className="whitespace-nowrap py-4">
                                    <OpenExternalLink
                                        href={car.url}
                                        className={TABLE_OPEN_LINK_CLASS}
                                    >
                                        Открыть
                                    </OpenExternalLink>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
            <InspectionModal
                car={inspectionCar}
                onClose={() => setInspectionCar(null)}
            />
            <PriceHistoryModal
                car={priceHistoryCar}
                onClose={() => setPriceHistoryCar(null)}
            />
        </div>
    );
}
