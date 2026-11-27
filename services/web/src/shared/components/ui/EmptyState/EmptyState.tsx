import React from 'react';
import { cn } from '@/shared/utils/cn';
import { Button, type ButtonProps } from '../Button';
import styles from './EmptyState.module.scss';

type EmptyStateVariant = 'list' | 'filtered' | 'scoped';

interface EmptyStateProps {
  /**
   * `list`: listado sin elementos, invita a crear. `filtered`: filtro sin resultados,
   * invita a cambiar el filtro, nunca a crear. `scoped`: sin datos para un recorte
   * temporal. Solo `list` puede llevar `action`.
   */
  readonly variant?: EmptyStateVariant;
  /** Texto visible, requerido. Negativa neutra, en presente, sin disculpas. */
  readonly message: string;
  /** Acción de alta. Se ignora si `variant` no es `"list"`. */
  readonly action?: ButtonProps;
}

const VARIANT_CLASS: Record<EmptyStateVariant, string> = {
  list: styles.list,
  filtered: styles.filtered,
  scoped: styles.scoped,
};

export function EmptyState({ variant = 'list', message, action }: EmptyStateProps) {
  const showAction = variant === 'list' && Boolean(action);

  return (
    <div
      className={cn(styles.container, VARIANT_CLASS[variant])}
      aria-live={variant === 'filtered' ? 'polite' : undefined}
    >
      <p className={styles.message}>{message}</p>
      {showAction && action && <Button {...action} />}
    </div>
  );
}
