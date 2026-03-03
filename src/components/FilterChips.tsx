interface Props {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function FilterChips({ label, options, selected, onChange }: Props) {
  function toggle(value: string) {
    const next = new Set(selected);
    next.has(value) ? next.delete(value) : next.add(value);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest min-w-max">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => toggle(o)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
            selected.has(o)
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
          }`}
        >
          {o}
        </button>
      ))}
      {selected.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 ml-1 transition-colors"
        >
          сбросить
        </button>
      )}
    </div>
  );
}
