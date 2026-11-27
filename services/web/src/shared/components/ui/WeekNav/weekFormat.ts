// Portado de features/time-allocation/components/WeekNavigator/WeekNavigator.tsx
// (que ya resuelve cruce de mes y de año), adaptado a `Date` en vez de `string`
// `YYYY-MM-DD`. TZ: 'UTC' está fijado en Vitest — un literal `new Date('2026-08-24')`
// se parsea como medianoche UTC.

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function formatWeekRange(weekStart: Date): string {
  const monday = weekStart;
  const friday = addDays(monday, 4);

  const dayStart = monday.getUTCDate();
  const dayEnd = friday.getUTCDate();
  const monthStart = monday.getUTCMonth();
  const monthEnd = friday.getUTCMonth();
  const yearStart = monday.getUTCFullYear();
  const yearEnd = friday.getUTCFullYear();

  if (yearStart !== yearEnd) {
    return `Semana del ${dayStart} de ${MONTHS[monthStart]} ${yearStart} al ${dayEnd} de ${MONTHS[monthEnd]} ${yearEnd}`;
  }

  if (monthStart !== monthEnd) {
    return `Semana del ${dayStart} de ${MONTHS[monthStart]} al ${dayEnd} de ${MONTHS[monthEnd]} ${yearEnd}`;
  }

  return `Semana del ${dayStart} al ${dayEnd} de ${MONTHS[monthStart]} ${yearEnd}`;
}

export function isSameWeek(a: Date, b: Date): boolean {
  return getMonday(a).getTime() === getMonday(b).getTime();
}
