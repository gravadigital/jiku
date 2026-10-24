'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { lockDocument, unlockDocument } from '../services/docsApi';
import { releaseLockKeepalive } from '../services/docsClientApi';
import { isModuleUnavailable } from '../utils/moduleInvalidation';
import { newUlid } from '../utils/ulid';
import type { DocsError, DocsResult } from '../types/docs.types';

export type EditPhase = 'idle' | 'acquiring' | 'editing' | 'lost';

/** Quién tiene la reserva cuando `document_locked` (verbatim de `error.details`, CA-18). */
export interface LockBlocker {
  holder: string;
  via: 'human' | 'agent';
  expiresAt: string;
}

export const RENEW_INTERVAL_MS = 60_000;

const GENERIC_ERROR: DocsError = { code: 'internal_error', message: 'Internal error', status: 500 };

const toBlocker = (error: DocsError): LockBlocker | null => {
  const details = error.details as Partial<LockBlocker> | undefined;
  if (!details?.holder || !details.expiresAt) return null;
  return {
    holder: details.holder,
    via: details.via === 'agent' ? 'agent' : 'human',
    expiresAt: details.expiresAt,
  };
};

interface UseEditSessionOptions {
  documentId: string;
}

/**
 * Ciclo de vida de la reserva de edición (CA-29, R-7): toma con un `sessionId` nuevo, la renueva
 * cada 60 s con el MISMO `sessionId`, detecta reserva perdida/bloqueo y la libera al terminar, en
 * `pagehide` y al desmontar (con `keepalive`). Todo es estado de interfaz: no se deriva de la api.
 */
export function useEditSession({ documentId }: UseEditSessionOptions) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<EditPhase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<LockBlocker | null>(null);

  // El tick, `pagehide` y el cleanup leen el valor vigente sin re-suscribirse.
  const sessionRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const safeLock = useCallback(
    async (id: string): Promise<DocsResult<unknown>> => {
      try {
        return await lockDocument(documentId, id);
      } catch {
        // Fallo de red del Server Action: se trata como error genérico.
        return { ok: false, error: GENERIC_ERROR };
      }
    },
    [documentId]
  );

  const renew = useCallback(async () => {
    const id = sessionRef.current;
    if (!id) return;
    const result = await safeLock(id);
    if (sessionRef.current !== id) return; // se liberó mientras tanto
    if (result.ok) {
      setPhase('editing');
      setBlockedBy(null);
      return;
    }
    setPhase('lost');
    setBlockedBy(result.error.code === 'document_locked' ? toBlocker(result.error) : null);
  }, [safeLock]);

  const start = useCallback(async (): Promise<'ok' | 'locked' | DocsError> => {
    const id = newUlid();
    sessionRef.current = id;
    setSessionId(id);
    setBlockedBy(null);
    setPhase('acquiring');

    const result = await safeLock(id);
    if (result.ok) {
      setPhase('editing');
      stopTimer();
      timerRef.current = setInterval(() => void renew(), RENEW_INTERVAL_MS);
      return 'ok';
    }

    sessionRef.current = null;
    setSessionId(null);
    setPhase('idle');
    if (isModuleUnavailable(result.error)) {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    }
    if (result.error.code === 'document_locked') {
      setBlockedBy(toBlocker(result.error));
      return 'locked';
    }
    return result.error;
  }, [queryClient, renew, safeLock, stopTimer]);

  const release = useCallback(async () => {
    const id = sessionRef.current;
    stopTimer();
    sessionRef.current = null;
    setSessionId(null);
    setBlockedBy(null);
    setPhase('idle');
    if (!id) return;
    try {
      await unlockDocument(documentId, id);
    } catch {
      // Un fallo acá no se propaga: `lock_not_held` es que ya no la tenía y, si fue otra cosa,
      // la reserva vence sola a los 120 s.
    }
  }, [documentId, stopTimer]);

  const markBlocked = useCallback((details: LockBlocker | null) => {
    setBlockedBy(details);
    setPhase('lost');
  }, []);

  const clearBlocked = useCallback(() => setBlockedBy(null), []);

  useEffect(() => {
    const onPageHide = () => {
      if (sessionRef.current) releaseLockKeepalive(documentId, sessionRef.current);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      stopTimer();
      // Salida por navegación interna (Volver, breadcrumb): no se puede bloquear en App Router.
      if (sessionRef.current) releaseLockKeepalive(documentId, sessionRef.current);
    };
  }, [documentId, stopTimer]);

  return { phase, sessionId, blockedBy, start, release, markBlocked, clearBlocked };
}

export type EditSession = ReturnType<typeof useEditSession>;
