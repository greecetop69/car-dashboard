export interface CarPhoto {
  type: string;
  location: string;
  updatedDate: string;
  ordering: number;
}

export interface CarPriceHistoryItem {
  priceWon: number;
  recordedAt: string;
}

export type InspectionConditionKey =
  | "clean"
  | "repair"
  | "replace"
  | "replaceRepair"
  | "notFound";

export interface Car {
  id: number;
  origin?: "encar" | "kbcha";
  sourceId?: string;
  isActive?: boolean;
  isNew?: boolean;
  isFavorite?: boolean;
  year: number;
  mileageKm: number;
  price: number;
  priceWon: number;
  previousPriceWon?: number | null;
  priceDeltaWon?: number;
  priceTrend?: "up" | "down" | "same";
  priceHistory?: CarPriceHistoryItem[];
  url: string;
  inspectionUrl: string;
  diagnosisUrl: string;
  accidentUrl: string;
  hasInspection: boolean;
  inspectionCondition?: InspectionConditionKey | null;
  mainPhoto: string | null;
  photos: CarPhoto[];
  badge: string;
  modifiedDate: string;
}

export type SortKey = "sourceId" | "year" | "mileageKm" | "price" | "priceWon" | "caromotoPrice";
export type SortDir = "asc" | "desc";
