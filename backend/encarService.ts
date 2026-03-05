import { mapEncar, type CarPhoto, type ParsedCarRecord, type ParsedCarsResponse } from "./carSources.js";

interface RawPhoto {
  type?: string;
  location?: string;
  updatedDate?: string;
  ordering?: number;
}

interface RawCar {
  Id?: string;
  Badge?: string;
  FormYear?: string;
  Mileage?: number;
  Price?: number;
  ModifiedDate?: string;
  Photos?: RawPhoto[];
  Condition?: string[];
}

interface ApiSearchResponse {
  SearchResults?: RawCar[];
}

const SEARCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  Referer: "https://www.encar.com/",
  Origin: "https://www.encar.com",
  Accept: "application/json",
};

const SEARCH_QUERY =
  "(And.Hidden.N._.(C.CarType.N._.(C.Manufacturer.\uC544\uC6B0\uB514._.(C.ModelGroup.A3._.Model.\uB274 A3.)))_.Year.range(201700..)._.Price.range(..1400).)";

const PAGE_SIZE: Record<string, number> = { premium: 20, general: 50 };
const ENDPOINTS = ["premium", "general"];
const PHOTO_BASE = "https://ci.encar.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toKishinevTime(modifiedDate?: string) {
  if (!modifiedDate) return "";
  try {
    const dateStr = modifiedDate.replace(" +09", "+09:00");
    return new Date(dateStr).toLocaleString("ru-RU", {
      timeZone: "Europe/Chisinau",
    });
  } catch {
    return "";
  }
}

function normalizeCar(car: RawCar) {
  const photos = Array.isArray(car.Photos)
    ? car.Photos.map((p) => ({
        type: p.type ?? "",
        location: PHOTO_BASE + (p.location ?? ""),
        updatedDate: p.updatedDate ?? "",
        ordering: p.ordering ?? 0,
      }))
    : [];

  return {
    sourceId: car.Id ?? "",
    badge: car.Badge ?? "",
    year: Number(car.FormYear) || 0,
    mileageKm: car.Mileage ?? 0,
    priceWon: (car.Price ?? 0) * 10000,
    modifiedDate: toKishinevTime(car.ModifiedDate),
    mainPhoto: photos[0]?.location ?? null,
    photos,
    hasInspection: (car.Condition ?? []).includes("Inspection"),
  };
}

type NormalizedCar = ReturnType<typeof normalizeCar>;

async function fetchOnePage(type: string, offset: number) {
  const url = `https://api.encar.com/search/car/list/${type}`;
  const params = new URLSearchParams({
    count: "true",
    q: SEARCH_QUERY,
    sr: `|ModifiedDate|${offset}|${PAGE_SIZE[type]}`,
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: SEARCH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${type}/${offset}`);
  }

  const data = (await response.json()) as ApiSearchResponse;
  return data.SearchResults ?? [];
}

function deduplicate(cars: NormalizedCar[]) {
  const seenSource = new Set<string>();
  const seenFingerprint = new Set<string>();
  return cars.filter((car) => {
    const sourceKey = car.sourceId || "";
    if (sourceKey && seenSource.has(sourceKey)) return false;
    if (sourceKey) seenSource.add(sourceKey);

    // Encar can return duplicate listings with different ids (premium/general feeds).
    const fingerprint = `${car.year}|${car.mileageKm}|${car.priceWon}`;
    if (seenFingerprint.has(fingerprint)) return false;
    seenFingerprint.add(fingerprint);
    return true;
  });
}

function mapCars(cars: NormalizedCar[]): ParsedCarRecord[] {
  return cars.map((r) => mapEncar(r));
}

export async function fetchEncarCars(): Promise<ParsedCarsResponse> {
  const allCars: NormalizedCar[] = [];

  for (const type of ENDPOINTS) {
    let page = 0;
    while (true) {
      const offset = page * PAGE_SIZE[type];
      const cars = await fetchOnePage(type, offset);
      if (cars.length === 0) break;

      allCars.push(...cars.map(normalizeCar));
      if (cars.length < PAGE_SIZE[type]) break;

      page += 1;
      await sleep(1200);
    }
  }

  const uniqueCars = deduplicate(allCars);
  const mappedCars = mapCars(uniqueCars);

  return {
    cars: mappedCars,
    updatedAt: new Date().toISOString(),
  };
}
