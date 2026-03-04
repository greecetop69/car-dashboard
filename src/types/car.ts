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

export interface Car {
  id: number;
  sourceId?: string;
  isActive?: boolean;
  isNew?: boolean;
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
  mainPhoto: string | null;
  photos: CarPhoto[];
  badge: string;
  modifiedDate: string;
}

export type SortKey = "year" | "mileageKm" | "price" | "priceWon" | "caromotoPrice";
export type SortDir = "asc" | "desc";
