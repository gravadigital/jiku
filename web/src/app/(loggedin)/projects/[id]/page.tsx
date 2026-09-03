'use client';
import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/features/projects';
import { ProjectAttachmentsSection } from '@/features/projects/components/ProjectAttachmentsSection';
import { ProjectDescription } from '@/features/projects/components/ProjectDescription';
import { ProjectGeneralInfo } from '@/features/projects/components/ProjectGeneralInfo';
import { ProjectObjectivesSection } from '@/features/projects/components/ProjectObjectivesSection';
import { ProjectProperties } from '@/features/projects/components/ProjectProperties';
import { ProjectRequirementsSection } from '@/features/projects/components/ProjectRequirementsSection';
import { Button, Card, Loader } from '@/shared/components/ui';
import styles from './styles.module.scss';

export default function ProjectDetail({ params }: { readonly params: Promise<{ id: number }> }) {
  const { id } = use(params);
  const { push } = useRouter();

  const { data: project, isLoading: isLoadingProject } = useProject({ id });

  const handleEdit = () => {
    push(`/projects/edit/${id}`);
  };

  if (isLoadingProject || !project) {
    return <Loader label="Cargando..." />;
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{project.name}</h1>
        <div className={styles.headerActions}>
          <Button variant="secondary-nav" href="/projects">
            Volver
          </Button>
          <Button variant="secondary-nav" onClick={handleEdit}>
            Editar
          </Button>
        </div>
      </div>

      <div className={styles.twoColumnLayout}>
        {/* Columna izquierda */}
        <div className={styles.leftColumn}>
          <Card variant="panel" title="Descripción" headingLevel="h2">
            <ProjectDescription project={project} />
          </Card>

          <ProjectRequirementsSection projectId={project.id!} />

          <ProjectObjectivesSection projectId={project.id!} />
        </div>

        {/* Columna derecha */}
        <div className={styles.rightColumn}>
          <Card variant="panel" title="Información general" headingLevel="h2">
            <ProjectGeneralInfo project={project} />
          </Card>

          <Card variant="panel" title="Propiedades" headingLevel="h2">
            <ProjectProperties project={project} />
          </Card>

          <ProjectAttachmentsSection projectId={id} />
        </div>
      </div>
    </div>
  );
}
