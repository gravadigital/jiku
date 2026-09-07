/**
 * Acepta `string` además de `Date` porque la api devuelve las fechas serializadas
 * (`createdAt: {type: string, format: date-time}` en docs/apis/api.yaml) y los tipos de dominio
 * de `web` están escritos a mano: un campo tipado `Date` que en runtime es un string ISO no
 * falla en compilación. Recibirlo acá evita que cada llamador tenga que acordarse de envolver
 * en `new Date()` — olvidarlo tumbaba la pantalla entera con "getTime is not a function".
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) {
    return 'N / D';
  }

  const parsed = date instanceof Date ? date : new Date(date);
  if (isNaN(parsed.getTime())) {
    return 'N / D';
  }

  const day = parsed.toUTCString().slice(5, 7);
  const month = parsed.toUTCString().slice(8, 11);
  return `${day} ${month}`;
};
