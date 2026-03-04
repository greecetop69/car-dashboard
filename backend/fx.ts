const FX_API_URL = "https://api.exchangerate-api.com/v4/latest/KRW";
const FALLBACK_WON_TO_EUR = 0.00058;
const FX_CACHE_TTL_MS = 15 * 60 * 1000;

let fxCache: { value: number; fetchedAt: number } | null = null;

export async function getWonToEurRate(): Promise<number> {
  if (fxCache && Date.now() - fxCache.fetchedAt < FX_CACHE_TTL_MS) {
    return fxCache.value;
  }

  try {
    const response = await fetch(FX_API_URL);
    if (!response.ok) {
      return fxCache?.value ?? FALLBACK_WON_TO_EUR;
    }

    const data = (await response.json()) as { rates?: { EUR?: number } };
    const value = data?.rates?.EUR ?? fxCache?.value ?? FALLBACK_WON_TO_EUR;
    fxCache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return fxCache?.value ?? FALLBACK_WON_TO_EUR;
  }
}
