'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Bell, BellOff, Check, Link, X } from 'lucide-react';
import { useSubscribe } from '@/features/subscriptions/hooks/useSubscribe';
import { useUnsubscribe } from '@/features/subscriptions/hooks/useUnsubscribe';
import type { Subscriber } from '@/features/subscriptions/types/subscription.types';
import styles from './ModalTopbar.module.scss';

interface ModalTopbarProps {
  projectName: string;
  requirementId: number;
  projectId: number;
  onClose: () => void;
  isExternalUser?: boolean;
  currentUserId?: string;
  subscribers?: Subscriber[];
}

export function ModalTopbar({
  projectName,
  requirementId,
  projectId,
  onClose,
  isExternalUser = false,
  currentUserId = '',
  subscribers = [],
}: ModalTopbarProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const isSubscribed = subscribers.some((s) => s.id === currentUserId);

  const {
    mutate: subscribe,
    isPending: isSubscribing,
    isError: isSubscribeError,
  } = useSubscribe({ requirementId });
  const {
    mutate: unsubscribe,
    isPending: isUnsubscribing,
    isError: isUnsubscribeError,
  } = useUnsubscribe({ requirementId });

  const isPending = isSubscribing || isUnsubscribing;
  const isError = isSubscribeError || isUnsubscribeError;

  function handleSubscribeClick() {
    if (isPending) return;
    if (isSubscribed) {
      unsubscribe(currentUserId);
    } else {
      subscribe(currentUserId);
    }
  }

  function handleOpen() {
    router.push(`/projects/${projectId}/requirements/${requirementId}`);
    onClose();
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(
      `${window.location.origin}/projects/${projectId}/requirements/${requirementId}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.topbar}>
      <span className={styles.projectName}>{projectName}</span>
      <span className={styles.separator}>›</span>
      <span className={styles.requirementId}>#{requirementId}</span>

      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionBtnFirst}`}
        onClick={handleOpen}
        aria-label="Abrir requisito en nueva pestaña"
        title="Abrir"
      >
        <ArrowUpRight size={14} aria-hidden="true" />
        Abrir
      </button>

      <button
        type="button"
        className={styles.actionBtn}
        onClick={handleCopyLink}
        aria-label="Copiar enlace del requisito"
        title="Enlace"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Link size={14} aria-hidden="true" />}
        {copied ? 'Copiado' : 'Enlace'}
      </button>

      {isExternalUser && (
        <button
          type="button"
          className={`${styles.actionBtn} ${isSubscribed ? styles.actionBtnSubscribed : ''} ${isError ? styles.actionBtnError : ''}`}
          onClick={handleSubscribeClick}
          disabled={isPending}
          aria-label={isSubscribed ? 'Desuscribirse del requisito' : 'Suscribirse al requisito'}
          title={
            isError
              ? 'Error al procesar la solicitud'
              : isSubscribed
                ? 'Desuscribirse'
                : 'Suscribirse'
          }
        >
          {isSubscribed ? (
            <BellOff size={14} aria-hidden="true" />
          ) : (
            <Bell size={14} aria-hidden="true" />
          )}
          {isPending ? '...' : isError ? 'Error' : isSubscribed ? 'Desuscribirse' : 'Suscribirse'}
        </button>
      )}

      <button
        type="button"
        className={styles.actionBtn}
        onClick={onClose}
        aria-label="Cerrar modal"
        title="Cerrar"
      >
        <X size={14} aria-hidden="true" />
        Cerrar
      </button>
    </div>
  );
}
