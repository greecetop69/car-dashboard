import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/httpClient";
import { queryKeys } from "../api/queryKeys";
import type { NotificationsResponse } from "../types/notification";

async function fetchNotifications() {
  const response = await api.get<NotificationsResponse>("/notifications");
  return response.data;
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      await api.post("/notifications/read", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
