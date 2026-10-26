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

/** Texto de `aviso-bloqueado` (P-17). */
export function lockedMessage(lock: LockHolder, currentUserId?: string | null): string {
  if (lock.via === 'human' && currentUserId && lock.holder === currentUserId) {
    return 'Lo estás editando en otra pestaña o ventana.';
  }
  return `${lockHolderLabel(lock)} lo está editando hasta las ${formatTime(lock.expiresAt)}. Podés leerlo mientras tanto.`;
}
