export default function dateToDateString(date: Date): string {
  const dayLabel = date.getDate().toString().padStart(2, '0');
  const monthLabel = (date.getMonth() + 1).toString().padStart(2, '0');
  const yearLabel = date.getFullYear().toString();

  return `${dayLabel}/${monthLabel}/${yearLabel}`;
}
