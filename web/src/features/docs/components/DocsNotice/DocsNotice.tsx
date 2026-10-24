import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './DocsNotice.module.scss';

interface DocsNoticeProps {
  readonly intent: 'warning' | 'error';
  readonly children: React.ReactNode;
}

// DS gap aceptado (REQ-016): `web` no tiene componente `alert`. Aviso local con role="alert"
// y tokens de estado; el ícono es decorativo y el significado lo lleva el texto.
export function DocsNotice({ intent, children }: DocsNoticeProps) {
  return (
    <div role="alert" className={cn(styles.notice, styles[intent])}>
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 2 16.5 15h-15L9 2Zm0 4.5v4m0 2.5v.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className={styles.text}>{children}</p>
    </div>
  );
}
