import { useEffect, useMemo, useRef, useState } from "react";
import { useMarkNotificationsRead, useNotifications } from "./useNotifications";
import type { NotificationItem } from "../types/notification";

interface Params {
  onNavigateToCar?: (origin: "encar" | "kbcha" | "kcar", sourceId: string) => void;
}

export function useNotificationsPopover({ onNavigateToCar }: Params) {
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useNotifications();
  const markReadMutation = useMarkNotificationsRead();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const markedIdsRef = useRef<Set<number>>(new Set());

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", onOutsideClick);
    }
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleUnreadIds: number[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idRaw = (entry.target as HTMLElement).dataset.notificationId;
          const isRead = (entry.target as HTMLElement).dataset.isRead === "true";
          const id = Number(idRaw);
          if (!Number.isInteger(id) || id <= 0 || isRead) continue;
          if (markedIdsRef.current.has(id)) continue;
          markedIdsRef.current.add(id);
          visibleUnreadIds.push(id);
        }
        if (visibleUnreadIds.length > 0) {
          markReadMutation.mutate(visibleUnreadIds);
        }
      },
      { threshold: 0.8 },
    );

    const targets = rootRef.current?.querySelectorAll("[data-notification-id]") ?? [];
    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, [items, open, markReadMutation]);

  const title = useMemo(
    () => (hasUnread ? `Уведомления (${unreadCount})` : "Уведомления"),
    [hasUnread, unreadCount],
  );

  function handleNotificationClick(item: NotificationItem) {
    if (!item.carOrigin || !item.carSourceId) return;
    onNavigateToCar?.(item.carOrigin, item.carSourceId);
    setOpen(false);
  }

  return {
    rootRef,
    open,
    setOpen,
    items,
    hasUnread,
    unreadCount,
    isFetching,
    title,
    handleNotificationClick,
  };
}
