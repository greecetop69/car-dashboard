import { useQuery } from "@tanstack/react-query";
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

const api = axios.create({
  baseURL: "/api",
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
