import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { queryKeys } from "../api/queryKeys";
import type { InspectionSummary } from "../types/inspection";

const api = axios.create({ baseURL: "/api" });

export async function fetchInspection(vehicleId: number, fallbackIds: number[]) {
  const params =
    fallbackIds.length > 0
      ? { fallbackIds: fallbackIds.join(",") }
      : undefined;
  const response = await api.get<InspectionSummary>(`/inspection/${vehicleId}`, { params });
  return response.data;
}

export function useInspection(vehicleId: number | null, fallbackIds: number[] = []) {
  return useQuery({
    queryKey: vehicleId != null ? queryKeys.inspection(vehicleId, fallbackIds) : ["inspection", "none"],
    queryFn: () => fetchInspection(vehicleId as number, fallbackIds),
    enabled: vehicleId != null,
  });
}
