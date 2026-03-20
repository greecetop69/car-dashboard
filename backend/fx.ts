const KRW_FX_API_URL = "https://api.exchangerate-api.com/v4/latest/KRW";
const VICTORIABANK_RATES_URL = "https://www.victoriabank.md/curs-valutar";
const FALLBACK_WON_TO_USD = 0.00069;
const FALLBACK_WON_TO_EUR = 0.00058;
const FALLBACK_EUR_TO_MDL = 20.05;
const FX_CACHE_TTL_MS = 15 * 60 * 1000;

interface KrwRates {
  wonToUsd: number;
  wonToEur: number;
}

let krwRatesCache: { value: KrwRates; fetchedAt: number } | null = null;
let eurToMdlCache: { value: number; fetchedAt: number } | null = null;

function parseLocalizedRate(raw: string) {
  const normalized = raw.replace(",", ".").trim();
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function getKrwRates(): Promise<KrwRates> {
  if (krwRatesCache && Date.now() - krwRatesCache.fetchedAt < FX_CACHE_TTL_MS) {
    return krwRatesCache.value;
  }

  try {
    const response = await fetch(KRW_FX_API_URL);
    if (!response.ok) {
      return (
        krwRatesCache?.value ?? {
          wonToUsd: FALLBACK_WON_TO_USD,
          wonToEur: FALLBACK_WON_TO_EUR,
        }
      );
    }

    const data = (await response.json()) as {
      rates?: { USD?: number; EUR?: number };
    };
    const value: KrwRates = {
      wonToUsd:
        data?.rates?.USD ??
        krwRatesCache?.value.wonToUsd ??
        FALLBACK_WON_TO_USD,
      wonToEur:
        data?.rates?.EUR ??
        krwRatesCache?.value.wonToEur ??
        FALLBACK_WON_TO_EUR,
    };

    krwRatesCache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return (
      krwRatesCache?.value ?? {
        wonToUsd: FALLBACK_WON_TO_USD,
        wonToEur: FALLBACK_WON_TO_EUR,
      }
    );
  }
}

export async function getWonToUsdRate(): Promise<number> {
  const rates = await getKrwRates();
  return rates.wonToUsd;
}

export async function getWonToEurRate(): Promise<number> {
  const rates = await getKrwRates();
  return rates.wonToEur;
}

export async function getEurToMdlRate(): Promise<number> {
  if (eurToMdlCache && Date.now() - eurToMdlCache.fetchedAt < FX_CACHE_TTL_MS) {
    return eurToMdlCache.value;
  }

  try {
    const response = await fetch(VICTORIABANK_RATES_URL);
    if (!response.ok) {
      return eurToMdlCache?.value ?? FALLBACK_EUR_TO_MDL;
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const eurMatch = text.match(
      /EUR\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)/i,
    );
    const eurSaleRate = eurMatch?.[2] ? parseLocalizedRate(eurMatch[2]) : null;
    const value = eurSaleRate ?? eurToMdlCache?.value ?? FALLBACK_EUR_TO_MDL;

    eurToMdlCache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return eurToMdlCache?.value ?? FALLBACK_EUR_TO_MDL;
  }
}
