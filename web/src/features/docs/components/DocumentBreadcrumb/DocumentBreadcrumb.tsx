'use client';

import Link from 'next/link';
import { useFolderTrail } from '../../hooks/useFolderTrail';
import styles from './DocumentBreadcrumb.module.scss';

interface DocumentBreadcrumbProps {
  readonly folder: { readonly id: string; readonly path: string };
}

// Con el trail de carpetas (S-082, P-5) cada nivel enlaza a `/docs?folder=`. Mientras carga o si
// falla, cae al comportamiento de S-081: la respuesta solo trae el id de la carpeta inmediata,
// así que solo el último nivel enlaza y los intermedios son texto.
export function DocumentBreadcrumb({ folder }: DocumentBreadcrumbProps) {
  const { data } = useFolderTrail({ folderId: folder.id });
  const segments = folder.path.split('/').filter(Boolean);
  const trail = data?.trail;

  return (
    <nav aria-label="Ruta" className={styles.nav}>
      <ol className={styles.list}>
        <li>
          <Link href="/docs" className={styles.link}>
            Documentación
          </Link>
        </li>
        {segments.map((segment, index) => {
          const linkedId = trail
            ? trail[index]?.id
            : index === segments.length - 1
              ? folder.id
              : null;
          return (
            <li key={`${index}-${segment}`}>
              {linkedId ? (
                <Link href={`/docs?folder=${linkedId}`} className={styles.link}>
                  {segment}
                </Link>
              ) : (
                <span className={styles.text}>{segment}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
