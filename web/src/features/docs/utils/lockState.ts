import { formatTime } from './dates';
import { personName } from './persons';
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
  via: 'human' | 'agent';
  expiresAt: string;
}

interface PersonLike {
  userId?: string | null;
  firstName: string;
  lastName: string;
}

/** Texto de `aviso-bloqueado` (P-17). */
export function lockedMessage(
  lock: LockHolder,
  persons: readonly PersonLike[] | undefined
): string {
  const who = lock.via === 'agent' ? 'Un agente' : personName(persons, lock.holder);
  return `${who} lo está editando hasta las ${formatTime(lock.expiresAt)}. Podés leerlo mientras tanto.`;
}
