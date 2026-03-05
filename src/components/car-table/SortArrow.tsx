import type { SortDir } from "../../types/car";

export default function SortArrow({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) {
    return <span className="ml-1 text-[10px] text-slate-300">↕</span>;
  }

  return <span className="ml-1 text-[10px] text-blue-500">{dir === "asc" ? "↑" : "↓"}</span>;
}
