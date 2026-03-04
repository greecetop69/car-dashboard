import type { Car } from "../types/car";

export const CAROMOTO_ADDON_BY_YEAR: Record<number, number> = {
  2020: 4511,
  2019: 4698,
  2018: 4910,
};

export function getCaromotoAddonByYear(year: number): number | null {
  const addon = CAROMOTO_ADDON_BY_YEAR[year];
  return addon ?? null;
}

export function getCaromotoPriceEur(car: Pick<Car, "year" | "price">): number | null {
  const addon = getCaromotoAddonByYear(car.year);
  if (addon == null) return null;
  return car.price + addon;
}

export function compareByCaromotoPrice(
  a: Pick<Car, "year" | "price">,
  b: Pick<Car, "year" | "price">,
  dir: "asc" | "desc",
): number {
  const va = getCaromotoPriceEur(a);
  const vb = getCaromotoPriceEur(b);

  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;

  const cmp = va < vb ? -1 : va > vb ? 1 : 0;
  return dir === "asc" ? cmp : -cmp;
}
