'use client';

import type { Subscriber } from '@/features/subscriptions/types/subscription.types';
import styles from './SubscribersList.module.scss';

interface SubscribersListProps {
  subscribers: Subscriber[];
}

export function SubscribersList({ subscribers }: SubscribersListProps) {
  if (subscribers.length === 0) {
    return <div className={styles.empty}>Sin suscriptores</div>;
  }

  return (
    <ul className={styles.list}>
      {subscribers.map((subscriber) => (
        <li key={subscriber.id} className={styles.item}>
          <span className={styles.name}>{subscriber.name}</span>
        </li>
      ))}
    </ul>
  );
}
