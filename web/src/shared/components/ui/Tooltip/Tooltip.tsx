import React from 'react';
import styles from './Tooltip.module.scss';

interface TooltipProps {
  readonly message: string;
  readonly children: React.ReactNode;
  readonly disableTooltip?: boolean;
}

export function Tooltip({ message, disableTooltip, children }: TooltipProps) {
  return (
    <div className={styles.tooltipContainer}>
      {children}
      {!disableTooltip && <p className={styles.tooltipContent}>{message}</p>}
    </div>
  );
}
