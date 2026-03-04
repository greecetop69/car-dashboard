export const queryKeys = {
  cars: ["cars"] as const,
  inspection: (vehicleId: number, fallbackIds: number[] = []) =>
    ["inspection", vehicleId, fallbackIds.join(",")] as const,
};
