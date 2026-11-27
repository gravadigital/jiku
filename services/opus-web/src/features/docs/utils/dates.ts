import { format } from 'date-fns';

/** `DD/MM/AAAA`; una fecha inválida se muestra como `—`. */
export function formatDocDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  return format(date, 'dd/MM/yyyy');
}
