import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Loader.module.scss';

type LoaderVariant = 'block' | 'inline';
type LoaderSize = 'md' | 'sm';

interface LoaderProps {
  /**
   * `block` ocupa el lugar del contenido y muestra el label. `inline` acompaña a un
   * elemento que ya está en pantalla y no muestra label visible.
   */
  readonly variant?: LoaderVariant;
  /** Diámetro del indicador. Default: `md` en `block`, `sm` en `inline`. */
  readonly size?: LoaderSize;
  /**
   * Sólo tiene efecto visible en `block` (en `inline` se usa como `aria-label`).
   * Único texto de la aplicación: "Cargando…" — una operación larga y nombrable
   * puede pasar un texto distinto ("Subiendo archivo…").
   */
  readonly label?: string;
}

export function Loader({ variant = 'block', size, label = 'Cargando…' }: LoaderProps) {
  const resolvedSize = size ?? (variant === 'inline' ? 'sm' : 'md');
  const isInline = variant === 'inline';

  return (
    <span
      className={cn(styles.loader, styles[variant])}
      role="status"
      aria-live="polite"
      aria-label={isInline ? 'Cargando' : undefined}
    >
      <span className={cn(styles.spinner, styles[resolvedSize])} aria-hidden="true" />
      {!isInline && <span className={styles.text}>{label}</span>}
    </span>
  );
}
