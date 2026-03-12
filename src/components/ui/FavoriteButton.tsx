import IconActionButton from "./IconActionButton";

interface FavoriteButtonProps {
    active: boolean;
    onToggle: () => void;
    size?: "sm" | "md";
    disabled?: boolean;
}

export default function FavoriteButton({
    active,
    onToggle,
    size = "md",
    disabled = false,
}: FavoriteButtonProps) {
    const sizeClass = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";
    const stateClass = disabled
        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
        : active
          ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100"
          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600";

    return (
        <IconActionButton
            title={
                disabled
                    ? "Избранное доступно только для активных машин и админа"
                    : active
                      ? "Убрать из избранного"
                      : "Добавить в избранное"
            }
            onClick={onToggle}
            className={`inline-flex items-center justify-center rounded-lg border transition-colors ${sizeClass} ${stateClass}`}
            disabled={disabled}
        >
            {active ? "★" : "☆"}
        </IconActionButton>
    );
}
