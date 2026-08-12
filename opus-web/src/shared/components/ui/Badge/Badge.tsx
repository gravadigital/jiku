import styles from './Badge.module.scss';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${className ?? ''}`} data-variant={variant}>
      {children}
    </span>
  );
}
