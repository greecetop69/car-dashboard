import type { NotificationItem } from "../../types/notification";
import { formatNotificationDate, isNotificationNavigable } from "../../utils/notifications";

interface Props {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
}

export default function NotificationListItem({ item, onClick }: Props) {
  return (
    <div
      data-notification-id={item.id}
      data-is-read={String(item.isRead)}
      onClick={() => onClick(item)}
      className={`px-4 py-3 transition-colors hover:bg-slate-50 ${item.isRead ? "bg-white" : "bg-blue-50/60"} ${
        isNotificationNavigable(item) ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
        {!item.isRead && (
          <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            NEW
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600">{item.message}</p>
      <p className="mt-1 text-[11px] text-slate-400">{formatNotificationDate(item.createdAt)}</p>
    </div>
  );
}
