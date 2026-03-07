export type CarOrigin = "encar" | "kbcha";

export interface CarPhoto {
  type: string;
  location: string;
  updatedDate: string;
  ordering: number;
}

export interface ParsedCarRecord {
  origin: CarOrigin;
  sourceId: string;
  year: number;
  mileageKm: number;
  priceWon: number;
  url: string;
  inspectionUrl: string;
  diagnosisUrl: string;
  accidentUrl: string;
  hasInspection: boolean;
  inspectionCondition?: "clean" | "repair" | "replace" | "replaceRepair" | "notFound" | null;
  mainPhoto: string | null;
  photos: CarPhoto[];
  badge: string;
  modifiedDate: string;
}

export interface ParsedCarsResponse {
  cars: ParsedCarRecord[];
  updatedAt: string;
  isPartial?: boolean;
  filter?: {
    minYear?: number;
    maxYear?: number;
    maxMileageKm?: number;
    maxPriceWon?: number;
  };
}

export interface EncarMapInput {
  sourceId: string;
  year: number;
  mileageKm: number;
  priceWon: number;
  hasInspection: boolean;
  mainPhoto: string | null;
  photos: CarPhoto[];
  badge: string;
  modifiedDate: string;
}

export interface KbchaMapInput {
  sourceId: string;
  year: number;
  mileageKm: number;
  sellAmt: number;
  accidentCount: number | null;
  mainPhoto: string | null;
  photos: CarPhoto[];
  badge: string;
  modifiedDate: string;
}

export function mapEncar(input: EncarMapInput): ParsedCarRecord {
  return {
    origin: "encar",
    sourceId: input.sourceId,
    year: input.year,
    mileageKm: input.mileageKm,
    priceWon: input.priceWon,
    url: `https://fem.encar.com/cars/detail/${input.sourceId}`,
    inspectionUrl: `https://fem.encar.com/cars/report/inspect/${input.sourceId}`,
    diagnosisUrl: `https://fem.encar.com/cars/report/diagnosis/${input.sourceId}`,
    accidentUrl: `https://fem.encar.com/cars/report/accident/${input.sourceId}`,
    hasInspection: input.hasInspection,
    mainPhoto: input.mainPhoto,
    photos: input.photos,
    badge: input.badge,
    modifiedDate: input.modifiedDate,
  };
}

export function mapKbcha(input: KbchaMapInput): ParsedCarRecord | null {
  if (!input.sourceId) return null;
  if (!Number.isFinite(input.sellAmt) || input.sellAmt <= 0) return null;

  const accidentCount = input.accidentCount;
  const hasAccidentCount = accidentCount != null && Number.isFinite(accidentCount) && accidentCount >= 0;
  const inspectionCondition =
    hasAccidentCount ? (accidentCount > 0 ? "repair" : "clean") : null;
  const detailUrl = `https://www.kbchachacha.com/public/car/detail.kbc?carSeq=${input.sourceId}`;

  return {
    origin: "kbcha",
    sourceId: input.sourceId,
    year: input.year,
    mileageKm: input.mileageKm,
    priceWon: input.sellAmt * 10000,
    url: detailUrl,
    inspectionUrl: detailUrl,
    diagnosisUrl: detailUrl,
    accidentUrl: detailUrl,
    hasInspection: hasAccidentCount,
    inspectionCondition,
    mainPhoto: input.mainPhoto,
    photos: input.photos,
    badge: input.badge,
    modifiedDate: input.modifiedDate,
  };
}

function sourcePriority(origin: CarOrigin) {
  return origin === "encar" ? 2 : 1;
}

function priceBucket(priceWon: number) {
  return Math.round(priceWon / 100000) * 100000;
}

function mileageClose(a: number, b: number) {
  return Math.abs(a - b) <= 1200;
}

export function deduplicateCrossSource(cars: ParsedCarRecord[]) {
  const bySourceId = new Set<string>();
  const sourceUnique = cars.filter((car) => {
    const key = `${car.origin}:${car.sourceId}`;
    if (bySourceId.has(key)) return false;
    bySourceId.add(key);
    return true;
  });

  const ordered = [...sourceUnique].sort((a, b) => {
    const p = sourcePriority(b.origin) - sourcePriority(a.origin);
    if (p !== 0) return p;
    return a.priceWon - b.priceWon;
  });

  const grouped = new Map<string, ParsedCarRecord[]>();
  const result: ParsedCarRecord[] = [];

  for (const car of ordered) {
    const key = `${car.year}|${priceBucket(car.priceWon)}`;
    const bucket = grouped.get(key) ?? [];
    const duplicate = bucket.some((existing) => mileageClose(existing.mileageKm, car.mileageKm));
    if (duplicate) continue;

    bucket.push(car);
    grouped.set(key, bucket);
    result.push(car);
  }

  return result;
}
