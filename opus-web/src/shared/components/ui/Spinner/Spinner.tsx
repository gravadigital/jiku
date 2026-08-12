import styles from './Spinner.module.scss';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <span className={styles.spinner} data-size={size} role="status" aria-label="Cargando">
      <span className={styles.visuallyHidden}>Cargando...</span>
    </span>
  );
}
