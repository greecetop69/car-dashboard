interface Props {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format?: (n: number) => string;
  disabled?: boolean;
}

export default function RangeFilter({
  label,
  min,
  max,
  value,
  onChange,
  format = String,
  disabled = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <span className="self-end font-mono text-[11px] text-slate-500 sm:self-auto sm:text-xs">
          {format(value[0])} — {format(value[1])}
        </span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          disabled={disabled}
          onChange={(e) => onChange([Math.min(+e.target.value, value[1]), value[1]])}
          className="range-slider w-full"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          disabled={disabled}
          onChange={(e) => onChange([value[0], Math.max(+e.target.value, value[0])])}
          className="range-slider w-full"
        />
      </div>
    </div>
  );
}
