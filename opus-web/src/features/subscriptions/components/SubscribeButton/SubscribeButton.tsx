'use client';

import { useState } from 'react';
import { useSubscribe } from '@/features/subscriptions/hooks/useSubscribe';
import { useUnsubscribe } from '@/features/subscriptions/hooks/useUnsubscribe';
import type { Subscriber } from '@/features/subscriptions/types/subscription.types';
import styles from './SubscribeButton.module.scss';

interface SubscribeButtonProps {
  requirementId: number;
  currentUserId: string;
  subscribers: Subscriber[];
}

export function SubscribeButton({
  requirementId,
  currentUserId,
  subscribers,
}: SubscribeButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const isSubscribed = subscribers.some((s) => s.id === currentUserId);

  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe({ requirementId });
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe({ requirementId });

  const isPending = isSubscribing || isUnsubscribing;

  function handleClick() {
    setError(null);
    if (isSubscribed) {
      unsubscribe(currentUserId, {
        onError: (err) =>
          setError((err as { message?: string }).message ?? 'Error al desuscribirse'),
      });
    } else {
      subscribe(currentUserId, {
        onError: (err) => setError((err as { message?: string }).message ?? 'Error al suscribirse'),
      });
    }
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.button} onClick={handleClick} disabled={isPending}>
        {isPending ? 'Cargando...' : isSubscribed ? 'Desuscribirse' : 'Suscribirse'}
      </button>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
}
