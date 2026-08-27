'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/features/projects';
import { Spinner, Button } from '@/shared/components/ui';
import { useLogout } from '@/shared/hooks/useLogout';
import styles from './page.module.scss';

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading, isError, refetch } = useProjects();
  const logout = useLogout();

  // Sort projects alphabetically by name
  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // Auto-navigate to first project (sorted alphabetically)
  useEffect(() => {
    if (sortedProjects.length > 0) {
      const firstProject = sortedProjects[0];
      router.push(`/projects/${firstProject.id}/requirements?view=list`);
    }
  }, [sortedProjects, router]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.centered}>
          <Spinner size="lg" />
          <p className={styles.loadingText}>Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.container}>
        <div className={styles.centered}>
          <p className={styles.errorText}>Error al cargar los proyectos</p>
          <Button variant="primary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.centered}>
          <h1 className={styles.emptyTitle}>Todavía no tenés acceso a ningún proyecto</h1>
          <p className={styles.emptyText} aria-live="polite">
            Cuando el equipo te dé acceso a un proyecto, lo vas a ver acá. Si esperabas verlo ahora,
            escribile a tu contacto en Grava Digital.
          </p>
          <Button variant="secondary" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  // Si hay proyectos, el useEffect ya está redirigiendo
  // Mostramos spinner mientras redirige
  return (
    <div className={styles.container}>
      <div className={styles.centered}>
        <Spinner size="lg" />
        <p className={styles.loadingText}>Redirigiendo...</p>
      </div>
    </div>
  );
}
