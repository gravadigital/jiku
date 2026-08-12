'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bell, BellOff, Check, Link } from 'lucide-react';
import { useSubscribe } from '@/features/subscriptions/hooks/useSubscribe';
import { useUnsubscribe } from '@/features/subscriptions/hooks/useUnsubscribe';
import type { Subscriber } from '@/features/subscriptions/types/subscription.types';
import styles from './BoardHeader.module.scss';

interface BoardHeaderProps {
  projectName: string;
  projectId: number;
  onNewRequirement?: () => void;
  requirementId?: number;
  isExternalUser?: boolean;
  currentUserId?: string;
  subscribers?: Subscriber[];
}

export function BoardHeader({
  projectName,
  projectId,
  onNewRequirement: _onNewRequirement,
  requirementId,
  isExternalUser = false,
  currentUserId = '',
  subscribers = [],
}: BoardHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams?.get('view') || 'list';
  const [copied, setCopied] = useState(false);

  const isSubscribed = subscribers.some((s) => s.id === currentUserId);

  const {
    mutate: subscribe,
    isPending: isSubscribing,
    isError: isSubscribeError,
  } = useSubscribe({ requirementId: requirementId ?? 0 });
  const {
    mutate: unsubscribe,
    isPending: isUnsubscribing,
    isError: isUnsubscribeError,
  } = useUnsubscribe({ requirementId: requirementId ?? 0 });

  const isPending = isSubscribing || isUnsubscribing;
  const isError = isSubscribeError || isUnsubscribeError;

  function handleCopyLink() {
    navigator.clipboard.writeText(
      `${window.location.origin}/projects/${projectId}/requirements/${requirementId}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSubscribeClick() {
    if (isPending) return;
    if (isSubscribed) {
      unsubscribe(currentUserId);
    } else {
      subscribe(currentUserId);
    }
  }

  const handleViewChange = (view: 'list' | 'kanban') => {
    router.replace(`/projects/${projectId}/requirements?view=${view}`);
  };

  return (
    <header className={styles.header}>
      <div className={styles.breadcrumb}>
        <span className={styles.projectName}>{projectName}</span>
        <span className={styles.separator}>›</span>
        {requirementId !== undefined ? (
          <button
            type="button"
            className={styles.currentLink}
            onClick={() => router.push(`/projects/${projectId}/requirements`)}
          >
            Requisitos
          </button>
        ) : (
          <span className={styles.current}>Requisitos</span>
        )}
        {requirementId !== undefined && (
          <>
            <span className={styles.separator}>›</span>
            <span className={styles.current}>#{requirementId}</span>
          </>
        )}
      </div>
      {requirementId !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleCopyLink}
            aria-label="Copiar enlace del requisito"
          >
            {copied ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Link size={14} aria-hidden="true" />
            )}
            {copied ? 'Copiado' : 'Enlace'}
          </button>

          {isExternalUser && (
            <button
              type="button"
              className={`${styles.actionBtn} ${isSubscribed ? styles.actionBtnSubscribed : ''} ${isError ? styles.actionBtnError : ''}`}
              onClick={handleSubscribeClick}
              disabled={isPending}
              aria-label={isSubscribed ? 'Desuscribirse del requisito' : 'Suscribirse al requisito'}
              title={isError ? 'Error al procesar la solicitud' : undefined}
            >
              {isSubscribed ? (
                <BellOff size={14} aria-hidden="true" />
              ) : (
                <Bell size={14} aria-hidden="true" />
              )}
              {isPending
                ? '...'
                : isError
                  ? 'Error'
                  : isSubscribed
                    ? 'Desuscribirse'
                    : 'Suscribirse'}
            </button>
          )}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => router.push(`/projects/${projectId}/requirements`)}
            aria-label="Volver al board del proyecto"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Volver
          </button>
        </div>
      )}

      {requirementId === undefined && (
        <div className={styles.viewToggles}>
          <button
            className={`${styles.toggleBtn} ${currentView === 'list' ? styles.active : ''}`}
            onClick={() => handleViewChange('list')}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Lista
          </button>
          <button
            className={`${styles.toggleBtn} ${currentView === 'kanban' ? styles.active : ''}`}
            onClick={() => handleViewChange('kanban')}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Columnas
          </button>
        </div>
      )}
    </header>
  );
}
