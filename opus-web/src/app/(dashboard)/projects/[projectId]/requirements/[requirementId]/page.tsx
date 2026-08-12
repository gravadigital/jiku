'use client';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useRequirement } from '@/features/requirements';
import { RequirementDetailView } from '@/features/requirements/components/RequirementDetailView';
import { useProjects } from '@/features/projects';
import { Spinner, Button } from '@/shared/components/ui';
import styles from './page.module.scss';

export default function RequirementDetailPage() {
  const params = useParams<{ projectId: string; requirementId: string }>();
  const router = useRouter();
  const projectId = Number(params.projectId);
  const requirementId = Number(params.requirementId);

  const { data: requirement, isLoading, error, refetch } = useRequirement({ requirementId });
  const { data: projects } = useProjects();

  const projectName =
    projects?.find((p) => p.id === projectId)?.name ?? requirement?.project?.name ?? 'Proyecto';

  if (isLoading) {
    return (
      <div className={styles.centered}>
        <Spinner size="lg" />
        <p className={styles.loadingText}>Cargando requisito...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <p className={styles.errorText}>Error al cargar el requisito</p>
        <Button
          variant="secondary"
          onClick={() => router.push(`/projects/${projectId}/requirements`)}
        >
          Volver al listado
        </Button>
        <Button variant="primary" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className={styles.centered}>
        <p className={styles.errorText}>Requisito no encontrado</p>
        <Button
          variant="secondary"
          onClick={() => router.push(`/projects/${projectId}/requirements`)}
        >
          Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <RequirementDetailView
      requirement={requirement}
      projectName={projectName}
      projectId={projectId}
    />
  );
}
