'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useProjects } from '@/features/projects';
import styles from './DocumentHeader.module.scss';

interface DocumentHeaderProps {
  projectId: number;
  /** Sin título (estados de excepción) solo se muestra "Volver". */
  title?: string;
}

export function DocumentHeader({ projectId, title }: DocumentHeaderProps) {
  const router = useRouter();
  const { data: projects } = useProjects();
  const projectName = projects?.find((p) => p.id === projectId)?.name ?? 'Proyecto';
  const boardHref = `/projects/${projectId}/requirements`;

  return (
    <header className={styles.header}>
      {title ? (
        <nav aria-label="Ubicación" className={styles.nav}>
          <ol className={styles.crumbs}>
            <li>
              <Link href={boardHref} className={styles.crumbLink}>
                {projectName}
              </Link>
            </li>
            <li className={styles.separator} aria-hidden="true">
              ›
            </li>
            <li>
              <Link href={boardHref} className={styles.crumbLink}>
                Documentación
              </Link>
            </li>
            <li className={styles.separator} aria-hidden="true">
              ›
            </li>
            <li className={styles.current} aria-current="page">
              {title}
            </li>
          </ol>
        </nav>
      ) : (
        <span />
      )}
      <Button variant="secondary" onClick={() => router.push(boardHref)}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver
      </Button>
    </header>
  );
}
