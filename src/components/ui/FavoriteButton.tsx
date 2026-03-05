import IconActionButton from "./IconActionButton";

interface FavoriteButtonProps {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}

export default function FavoriteButton({
  active,
  onToggle,
  size = "md",
}: FavoriteButtonProps) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";
  const stateClass = active
    ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100"
    : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600";

  return (
    <IconActionButton
      title={active ? "Убрать из избранного" : "Добавить в избранное"}
      onClick={onToggle}
      className={`inline-flex items-center justify-center rounded-lg border transition-colors ${sizeClass} ${stateClass}`}
    >
      {active ? "★" : "☆"}
    </IconActionButton>
  );
}
