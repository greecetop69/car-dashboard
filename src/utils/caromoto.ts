import type { Car } from "../types/car";

export const CAROMOTO_FIXED_COSTS_EUR = 3680;

export const CAROMOTO_CUSTOMS_BY_YEAR: Record<number, number> = {
  2020: 1978,
  2019: 2171,
  2018: 2383,
};

export function getCaromotoAddonByYear(year: number): number | null {
  const customs = CAROMOTO_CUSTOMS_BY_YEAR[year];
  if (customs == null) return null;
  return CAROMOTO_FIXED_COSTS_EUR + customs;
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
