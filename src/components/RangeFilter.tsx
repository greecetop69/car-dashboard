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
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          {label}
        </span>
        <span className="text-xs text-slate-500 font-mono">
          {format(value[0])} — {format(value[1])}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          disabled={disabled}
          onChange={(e) =>
            onChange([Math.min(+e.target.value, value[1]), value[1]])
          }
          className="w-full"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          disabled={disabled}
          onChange={(e) =>
            onChange([value[0], Math.max(+e.target.value, value[0])])
          }
          className="w-full"
        />
      </div>
    </div>
  );
}
