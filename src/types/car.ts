export type ConditionType =
    | "Не бита"
    | "Бита (замена + ремонт)"
    | "Бита (замена)"
    | "Бита (ремонт)"
    | "Другое";

export interface CarPhoto {
    type: string;
    location: string;
    updatedDate: string;
    ordering: number;
}

export interface Car {
    id: number;
    year: number;
    mileageKm: number;
    price: number;
    priceWon: number;
    url: string;
    inspectionUrl: string;
    diagnosisUrl: string;
    accidentUrl: string;
    hasInspection: boolean; // ← добавить
    mainPhoto: string | null;
    photos: CarPhoto[];
    badge: string;
    modifiedDate: string;
}

export type SortKey = keyof Pick<
    Car,
    "year" | "mileageKm" | "price" | "priceWon"
>;
export type SortDir = "asc" | "desc";

export interface Filters {
    search: string;
    conditions: Set<string>;
    colors: Set<string>;
    yearRange: [number, number];
    mileRange: [number, number];
    priceRange: [number, number];
}
