import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './DocsNotice.module.scss';

interface DocsNoticeProps {
  readonly intent: 'warning' | 'error' | 'info';
  /**
   * `alert` (default) se anuncia al aparecer. `none` para lo que ya estaba en pantalla al
   * abrir el documento y para renovaciones silenciosas (P-13).
   */
  readonly role?: 'alert' | 'none';
  readonly children: React.ReactNode;
}

// DS gap aceptado (REQ-016): `web` no tiene componente `alert`. Aviso local con role="alert"
// y tokens de estado; el ícono es decorativo y el significado lo lleva el texto.
export function DocsNotice({ intent, role = 'alert', children }: DocsNoticeProps) {
  return (
    <div role={role} className={cn(styles.notice, styles[intent])}>
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {intent === 'info' ? (
          <path
            d="M9 16A7 7 0 1 0 9 2a7 7 0 0 0 0 14Zm0-7.5V12.5m0-4v-.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M9 2 16.5 15h-15L9 2Zm0 4.5v4m0 2.5v.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <p className={styles.text}>{children}</p>
    </div>
  );
}
