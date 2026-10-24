const pad = (n: number): string => String(n).padStart(2, '0');

/** `DD/MM/AAAA HH:mm` con getters locales (igual que `labelFromDate`). */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
