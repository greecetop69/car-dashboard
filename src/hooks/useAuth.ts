import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/httpClient";
import { queryKeys } from "../api/queryKeys";
import type { AuthSessionResponse } from "../types/auth";
import { logAuthDebug } from "../utils/authDebug";

async function fetchSession() {
  const response = await api.get<AuthSessionResponse>("/auth/session");
  logAuthDebug("session_loaded", {
    authenticated: response.data.authenticated,
    email: response.data.user?.email ?? null,
    isAdmin: response.data.user?.isAdmin ?? false,
  });
  return response.data;
}

export function useAuthSession() {
  return useQuery({
    queryKey: queryKeys.auth,
    queryFn: fetchSession,
  });
}

export function useGoogleLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credential: string) => {
      const response = await api.post<AuthSessionResponse>("/auth/google", { credential });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthSessionResponse>("/auth/logout");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth });
    },
  });
}
