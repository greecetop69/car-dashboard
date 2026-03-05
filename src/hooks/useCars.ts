import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { Car } from "../types/car";
import { queryKeys } from "../api/queryKeys";

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

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
    /\/+$/,
    "",
);
const api = axios.create({
    baseURL: apiUrl ? `${apiUrl}/api` : "/api",
});

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
