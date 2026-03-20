export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function fmtEur(n: number): string {
  return "EUR\u202f" + fmt(n);
}

export function fmtUsd(n: number): string {
  return "USD\u202f" + fmt(n);
}

export function fmtMdl(n: number): string {
  return "MDL\u202f" + fmt(n);
}

export function fmtWon(n: number): string {
  return "KRW\u202f" + fmt(n);
}

export function fmtKm(n: number): string {
  return fmt(n) + " км";
}
