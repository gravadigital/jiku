import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import styles from './DocsAlert.module.scss';

interface DocsAlertProps {
  variant: 'warning' | 'error';
  children: ReactNode;
}

/** Aviso inline del módulo docs. El estado no se comunica solo con color: lleva ícono y texto. */
export function DocsAlert({ variant, children }: DocsAlertProps) {
  const Icon = variant === 'error' ? AlertCircle : AlertTriangle;
  return (
    <div
      className={styles.alert}
      data-variant={variant}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon size={16} className={styles.icon} aria-hidden="true" />
      <p className={styles.text}>{children}</p>
    </div>
  );
}
