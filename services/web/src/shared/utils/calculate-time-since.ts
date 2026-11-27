/**
 * Acepta `string` además de `Date` por el mismo motivo que `formatDate`: la api serializa las
 * fechas y los tipos de dominio de `web`, escritos a mano, las declaran `Date`.
 */
export const calculateTimeSince = (date: Date | string) => {
  const now = new Date();
  const parsed = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((now.getTime() - parsed.getTime()) / 1000);

  const intervals = [
    { label: 'día', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count === 1 ? '' : 's'}`;
    }
  }

  return 'menos de un minuto';
};
