export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  detail: string;
}

interface Props {
  state: TooltipState;
}

export default function BodyTooltip({ state }: Props) {
  if (!state.visible) return null;

  // Keep tooltip inside viewport
  const tooltipW = 240;
  const tooltipH = 200;
  const padding = 16;
  const left =
    state.x + tooltipW + padding > window.innerWidth
      ? state.x - tooltipW - 10
      : state.x + 14;
  const top =
    state.y + tooltipH + padding > window.innerHeight
      ? state.y - tooltipH - 10
      : state.y + 14;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left, top, width: tooltipW }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/80 p-4">
        {/* Title */}
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
          Кузов
        </p>

        {/* Damage description */}
        <p className="text-sm text-slate-700 leading-snug mb-3">{state.detail}</p>

        {/* Image placeholder — replace with <img> when ready */}
        <div className="w-full h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5">
          {/* Car icon */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          >
            <rect x="1" y="8" width="22" height="10" rx="2" />
            <path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </svg>
          <span className="text-[11px] text-slate-400 text-center">
            Схема повреждений
          </span>
        </div>
      </div>
    </div>
  );
}
