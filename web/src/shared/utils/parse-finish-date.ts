// `objectives.estimated_finish_date` es una columna VARCHAR con texto heredado: puede venir
// vacío, con otro formato o inválido. `new Date(texto)` lo convertiría en `Invalid Date` (que
// `calculateDaysLeft` cuenta como "vence hoy") y un `YYYY-MM-DD` se interpretaría en UTC
// (un día antes en UTC-3). Acá solo se acepta lo que empieza con `YYYY-MM-DD`, como fecha local.
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export const parseFinishDate = (value: Date | string | null | undefined): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const match = ISO_DATE_PREFIX.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Descarta 2026-13-45 y similares, que Date "rueda" a otro día.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};
