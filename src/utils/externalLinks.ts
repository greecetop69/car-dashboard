import type { Car } from "../types/car";

function isMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const userAgentData = nav.userAgentData;
  if (typeof userAgentData?.mobile === "boolean") {
    return userAgentData.mobile;
  }

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

function getKbchaSourceId(car: Car) {
  if (car.sourceId?.trim()) {
    return car.sourceId.trim();
  }

  const match = car.url.match(/[?&]carSeq=(\d+)/i);
  return match?.[1] ?? "";
}

export function getExternalCarUrl(car: Car) {
  if (car.origin !== "kbcha") {
    return car.url;
  }

  const sourceId = getKbchaSourceId(car);
  if (!sourceId) {
    return car.url;
  }

  if (isMobileDevice()) {
    return `https://m.kbchachacha.com/public/web/car/detail.kbc?carSeq=${sourceId}`;
  }

  return `https://www.kbchachacha.com/public/car/detail.kbc?carSeq=${sourceId}`;
}
