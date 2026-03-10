export const CHISINAU_TIME_ZONE = "Europe/Chisinau";

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTimeChisinau(value: string | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: CHISINAU_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDayKeyChisinau(value: string | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "unknown";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHISINAU_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
