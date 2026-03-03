export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function fmtEur(n: number): string {
  return "€\u202f" + fmt(n);
}
export function fmtWon(n: number): string {
  return "₩\u202f" + fmt(n);
}

export function fmtKm(n: number): string {
  return fmt(n) + " км";
}
