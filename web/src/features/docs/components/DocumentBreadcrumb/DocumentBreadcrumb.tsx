import Link from 'next/link';
import styles from './DocumentBreadcrumb.module.scss';

interface DocumentBreadcrumbProps {
  readonly folder: { readonly id: string; readonly path: string };
}

// P-7: la respuesta solo trae el id de la carpeta inmediata, así que solo el último nivel
// lleva a `/docs?folder=`; los intermedios son texto. S-082 define `/docs` y puede enriquecerlo.
export function DocumentBreadcrumb({ folder }: DocumentBreadcrumbProps) {
  const segments = folder.path.split('/').filter(Boolean);

  return (
    <nav aria-label="Ruta" className={styles.nav}>
      <ol className={styles.list}>
        <li>
          <Link href="/docs" className={styles.link}>
            Documentación
          </Link>
        </li>
        {segments.map((segment, index) => (
          <li key={`${index}-${segment}`}>
            {index === segments.length - 1 ? (
              <Link href={`/docs?folder=${folder.id}`} className={styles.link}>
                {segment}
              </Link>
            ) : (
              <span className={styles.text}>{segment}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
