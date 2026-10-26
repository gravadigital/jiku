import { formatTime } from './dates';
import type { DocsLock } from '../types/docs.types';

/** Hay un lock vigente de OTRA sesión (la propia nunca bloquea). */
export function isLockActive(
  lock: DocsLock | null | undefined,
  now: Date,
  mySessionId: string | null
): boolean {
  if (!lock) return false;
  if (mySessionId && lock.sessionId === mySessionId) return false;
  return new Date(lock.expiresAt) > now;
}

interface LockHolder {
  holder: string;
  holderName?: string | null;
  via: 'human' | 'agent';
  expiresAt: string;
}

/** Quién tiene la reserva: el nombre del servicio; `"Otra persona"` solo si no lo manda. */
export function lockHolderLabel(lock: Pick<LockHolder, 'holderName' | 'via'>): string {
  if (lock.via === 'agent') return 'Un agente';
  return lock.holderName?.trim() ? lock.holderName : 'Otra persona';
}

/**
 * Reserva propia: humana y cuyo `holder` es el `sub` de la persona actual.
 * `currentUserSub` es el `sub` de Zitadel (`session.user.zitadelId`), nunca el uuid de Jiku.
 */
function isOwnLock(lock: Pick<LockHolder, 'holder' | 'via'>, currentUserSub?: string | null): boolean {
  return lock.via === 'human' && Boolean(currentUserSub) && lock.holder === currentUserSub;
}

/** Texto de `aviso-bloqueado` (P-17). */
export function lockedMessage(lock: LockHolder, currentUserSub?: string | null): string {
  if (isOwnLock(lock, currentUserSub)) {
    return 'Lo estás editando en otra pestaña o ventana.';
  }
  return `${lockHolderLabel(lock)} lo está editando hasta las ${formatTime(lock.expiresAt)}. Podés leerlo mientras tanto.`;
}

/** Nombre accesible de `marca-en-edicion` en la fila del listado. */
export function lockRowLabel(
  lock: Pick<LockHolder, 'holder' | 'holderName' | 'via'>,
  currentUserSub?: string | null
): string {
  if (isOwnLock(lock, currentUserSub)) return 'Lo estás editando';
  const holder = lock.holderName?.trim();
  return holder ? `${holder} lo está editando` : 'Otra persona lo está editando';
}
