import styles from './AttachmentSkeleton.module.scss';

interface AttachmentSkeletonProps {
  isImage?: boolean;
}

export function AttachmentSkeleton({ isImage = false }: AttachmentSkeletonProps) {
  if (isImage) {
    return <div className={`${styles.base} ${styles.image}`} aria-label="Cargando imagen..." />;
  }
  return (
    <div className={`${styles.base} ${styles.file}`} aria-label="Cargando archivo...">
      <div className={styles.iconPlaceholder} />
      <div className={styles.namePlaceholder} />
      <div className={styles.sizePlaceholder} />
    </div>
  );
}
