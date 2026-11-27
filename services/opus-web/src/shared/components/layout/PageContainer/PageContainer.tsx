import styles from './PageContainer.module.scss';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function PageContainer({ children, className, maxWidth = 'xl' }: PageContainerProps) {
  return (
    <div className={`${styles.container} ${styles[maxWidth]} ${className ?? ''}`}>{children}</div>
  );
}
