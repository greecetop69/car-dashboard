export const queryKeys = {
  auth: ["auth"] as const,
  cars: ["cars"] as const,
  notifications: ["notifications"] as const,
  inspection: (vehicleId: number, fallbackIds: number[] = [], carId: number | null = null) =>
    ["inspection", vehicleId, fallbackIds.join(","), carId ?? "none"] as const,
};
