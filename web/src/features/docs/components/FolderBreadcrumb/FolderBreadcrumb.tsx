import Link from 'next/link';
import styles from './FolderBreadcrumb.module.scss';
import type { FolderTrailItem } from '../../types/docs.types';

interface FolderBreadcrumbProps {
  /** Niveles de la ruta, sin la raíz. Vacío = se está en `Inicio`. */
  readonly trail: readonly FolderTrailItem[];
}

// Breadcrumb de `/docs`: `Inicio` + un nivel por carpeta. El último nivel no lleva enlace;
// un ancestro ilegible (`id: null`) se muestra como texto (P-5).
export function FolderBreadcrumb({ trail }: FolderBreadcrumbProps) {
  return (
    <nav aria-label="Ruta de la carpeta" className={styles.nav}>
      <ol className={styles.list}>
        <li>
          {trail.length === 0 ? (
            <span className={styles.text} aria-current="page">
              Inicio
            </span>
          ) : (
            <Link href="/docs" className={styles.link}>
              Inicio
            </Link>
          )}
        </li>
        {trail.map((level, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${index}-${level.name}`}>
              {isLast || !level.id ? (
                <span className={styles.text} aria-current={isLast ? 'page' : undefined}>
                  {level.name}
                </span>
              ) : (
                <Link href={`/docs?folder=${level.id}`} className={styles.link}>
                  {level.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
