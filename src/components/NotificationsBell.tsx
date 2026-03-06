import { useNotificationsPopover } from "../hooks/useNotificationsPopover";
import NotificationListItem from "./notifications/NotificationListItem";

interface Props {
  onNavigateToCar?: (origin: "encar" | "kbcha", sourceId: string) => void;
}

export default function NotificationsBell({ onNavigateToCar }: Props) {
  const { rootRef, open, setOpen, items, hasUnread, unreadCount, isFetching, title, handleNotificationClick: onNotificationClick } =
    useNotificationsPopover({ onNavigateToCar });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative rounded-lg border px-3 py-2 text-sm transition ${
          hasUnread
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        }`}
        title={title}
      >
        <span className={hasUnread ? "inline-block animate-pulse" : "inline-block"}>🔔</span>
        {hasUnread && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[360px] max-w-[92vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {isFetching && <span className="text-xs text-slate-400">Обновление...</span>}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Пока пусто</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <NotificationListItem
                    key={item.id}
                    onClick={() => onNotificationClick(item)}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
