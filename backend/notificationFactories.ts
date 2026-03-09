import type { NotificationType } from "./db/entities/Notification.js";
import type { CarOrigin, ParsedCarRecord } from "./carSources.js";

export interface PendingNotification {
  type: NotificationType;
  carOrigin: CarOrigin | null;
  carSourceId: string | null;
  title: string;
  message: string;
  payloadJson: Record<string, unknown>;
}

function formatOriginLabel(origin: CarOrigin) {
  if (origin === "kbcha") return "KBCHA";
  if (origin === "kcar") return "KCAR";
  return "ENCAR";
}

export function buildNewCarNotification(parsed: ParsedCarRecord): PendingNotification {
  return {
    type: "new_car",
    carOrigin: parsed.origin,
    carSourceId: parsed.sourceId,
    title: "Новая машина",
    message: `${formatOriginLabel(parsed.origin)} #${parsed.sourceId}: ${parsed.year}, ${parsed.mileageKm} км, ₩ ${parsed.priceWon.toLocaleString("ru-RU")}`,
    payloadJson: {
      year: parsed.year,
      mileageKm: parsed.mileageKm,
      priceWon: parsed.priceWon,
      url: parsed.url,
      mainPhoto: parsed.mainPhoto,
    },
  };
}

export function buildPriceDropNotification(
  parsed: ParsedCarRecord,
  previousPriceWon: number,
): PendingNotification {
  return {
    type: "price_drop",
    carOrigin: parsed.origin,
    carSourceId: parsed.sourceId,
    title: "Снижение цены",
    message: `${formatOriginLabel(parsed.origin)} #${parsed.sourceId}: ₩ ${previousPriceWon.toLocaleString("ru-RU")} → ₩ ${parsed.priceWon.toLocaleString("ru-RU")}`,
    payloadJson: {
      oldPriceWon: previousPriceWon,
      newPriceWon: parsed.priceWon,
      deltaWon: previousPriceWon - parsed.priceWon,
      url: parsed.url,
      mainPhoto: parsed.mainPhoto,
    },
  };
}

export function buildCarSoldNotification(input: {
  origin: CarOrigin;
  sourceId: string;
  priceWon: number | null;
  url: string;
  mainPhoto?: string | null;
}): PendingNotification {
  return {
    type: "car_sold",
    carOrigin: input.origin,
    carSourceId: input.sourceId,
    title: "Машина помечена как купленная",
    message: `${formatOriginLabel(input.origin)} #${input.sourceId}${input.priceWon != null ? `, ₩ ${input.priceWon.toLocaleString("ru-RU")}` : ""}`,
    payloadJson: {
      priceWon: input.priceWon,
      url: input.url,
      mainPhoto: input.mainPhoto ?? null,
    },
  };
}
