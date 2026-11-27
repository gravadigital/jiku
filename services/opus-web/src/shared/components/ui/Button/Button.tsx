import { Spinner } from '../Spinner';
import styles from './Button.module.scss';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
  type = 'button',
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`${styles.button} ${className ?? ''}`}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      onClick={onClick}
      aria-disabled={isDisabled}
      aria-busy={loading}
    >
      {loading && (
        <span className={styles.spinnerWrapper}>
          <Spinner size="sm" />
        </span>
      )}
      <span className={loading ? styles.hiddenText : undefined}>{children}</span>
    </button>
  );
}
