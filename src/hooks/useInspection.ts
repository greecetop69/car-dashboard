import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { queryKeys } from "../api/queryKeys";
import type { InspectionSummary } from "../types/inspection";

const api = axios.create({ baseURL: "/api" });

export async function fetchInspection(
  vehicleId: number,
  fallbackIds: number[],
  carId: number | null = null,
) {
  const params: Record<string, string> = {};
  if (fallbackIds.length > 0) {
    params.fallbackIds = fallbackIds.join(",");
  }
  if (carId != null) {
    params.carId = String(carId);
  }

  const response = await api.get<InspectionSummary>(`/inspection/${vehicleId}`, { params });
  return response.data;
}

export function useInspection(
  vehicleId: number | null,
  fallbackIds: number[] = [],
  carId: number | null = null,
) {
  return useQuery({
    queryKey:
      vehicleId != null
        ? queryKeys.inspection(vehicleId, fallbackIds, carId)
        : ["inspection", "none"],
    queryFn: () => fetchInspection(vehicleId as number, fallbackIds, carId),
    enabled: vehicleId != null,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
