'use client';
import React, { MouseEvent, MouseEventHandler } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { Spinner } from '../Spinner';
import styles from './Button.module.scss';

interface ButtonProps {
  readonly label: string;
  readonly onClick?: MouseEventHandler<Element>;
  readonly href?: string;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly size?: 'normal' | 'small';
  readonly variant?: 'primary' | 'secondary';
  /**
   * Id del elemento que explica el estado del botón. El DS pide que un control
   * deshabilitado diga por qué lo está.
   */
  readonly ariaDescribedBy?: string;
}

export function Button(props: ButtonProps) {
  const { push } = useRouter();
  const {
    label,
    onClick,
    href,
    loading = false,
    disabled = false,
    size = 'normal',
    variant = 'primary',
    ariaDescribedBy,
  } = props;

  const handleClick = (event: MouseEvent) => {
    if (disabled || loading) return null;
    if (onClick) {
      return onClick(event);
    }
    if (href) {
      return push(href);
    }
    return null;
  };

  return (
    <span className={cn(styles.buttonContainer, { [styles.small]: size === 'small' })}>
      <button
        type="button"
        className={styles[variant]}
        disabled={disabled}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        aria-describedby={ariaDescribedBy}
        onClick={handleClick}
      >
        {loading ? (
          <>
            <span aria-hidden="true">
              <Spinner />
            </span>
            <span className="sr-only">Cargando...</span>
          </>
        ) : (
          label
        )}
      </button>
    </span>
  );
}
