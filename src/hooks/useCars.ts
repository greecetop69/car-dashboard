import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Car } from "../types/car";
import { queryKeys } from "../api/queryKeys";
import { api } from "../api/httpClient";

export interface CarsApiResponse {
    cars: Car[];
    meta: {
        minYear: number;
        maxYear: number;
        minMileage: number;
        maxMileage: number;
        minPrice: number;
        maxPrice: number;
    };
}

interface SyncCarsResponse {
    status: "ok";
    syncedCars: number;
    updatedAt: string;
}

async function fetchCars() {
    const response = await api.get<CarsApiResponse>("/cars");
    return response.data;
}

export function useCars() {
    return useQuery({
        queryKey: queryKeys.cars,
        queryFn: fetchCars,
    });
}

interface ToggleFavoriteInput {
    id: number;
    isFavorite: boolean;
}

export function useToggleFavorite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, isFavorite }: ToggleFavoriteInput) => {
            await api.post(`/cars/${id}/favorite`, { isFavorite });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cars });
        },
    });
}

export function useSyncCars() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await api.post<SyncCarsResponse>("/sync", null, {
                timeout: 210000,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cars });
        },
    });
}
