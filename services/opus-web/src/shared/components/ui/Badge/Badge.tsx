import styles from './Badge.module.scss';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
  /** Rol ARIA explicito. Sin rol, un `span` es `generic` y los lectores de pantalla ignoran
   *  su `aria-label`: quien necesite un nombre accesible tiene que declarar el rol. */
  role?: string;
  'aria-label'?: string;
}

export function Badge({
  variant = 'default',
  children,
  className,
  role,
  'aria-label': ariaLabel,
}: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${className ?? ''}`}
      data-variant={variant}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}
