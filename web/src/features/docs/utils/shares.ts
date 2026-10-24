import { formatDateTime } from './dates';
import type { DocsShare, ShareExpiryDays } from '../types/docs.types';

export const SHARE_EXPIRY_DAYS: readonly ShareExpiryDays[] = [7, 15, 30, 90, 180];

export const SHARE_EXPIRY_OPTIONS = SHARE_EXPIRY_DAYS.map((days) => ({
  value: String(days),
  label: `${days} días`,
}));

export const DEFAULT_SHARE_EXPIRY = '30';

const DAY_MS = 86_400_000;

/** P-1: la fecha de vencimiento se calcula con el reloj del servidor de Next. */
export const expiresAtFrom = (days: number, now: Date): string =>
  new Date(now.getTime() + days * DAY_MS).toISOString();

/** P-8: el estado lo informa la api; la web no lo recalcula. */
export function shareStatusBadge(status: DocsShare['status']): {
  label: string;
  family: 'resolved' | 'neutral';
} {
  switch (status) {
    case 'active':
      return { label: 'Activo', family: 'resolved' };
    case 'expired':
      return { label: 'Vencido', family: 'neutral' };
    default:
      return { label: 'Revocado', family: 'neutral' };
  }
}

/** P-9: descripción para distinguir los botones "Revocar" de cada fila. */
export const shareDescription = (share: Pick<DocsShare, 'expiresAt' | 'note'>): string =>
  `Link que vence el ${formatDateTime(share.expiresAt)}${share.note ? ` · ${share.note}` : ''}`;
