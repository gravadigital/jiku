'use client';
import React, { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/features/projects';
import { ProjectAttachmentsSection } from '@/features/projects/components/ProjectAttachmentsSection';
import { ProjectDescription } from '@/features/projects/components/ProjectDescription';
import { ProjectGeneralInfo } from '@/features/projects/components/ProjectGeneralInfo';
import { ProjectObjectivesSection } from '@/features/projects/components/ProjectObjectivesSection';
import { ProjectProperties } from '@/features/projects/components/ProjectProperties';
import { ProjectRequirementsSection } from '@/features/projects/components/ProjectRequirementsSection';
import { Loader } from '@/shared/components/ui';
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
          <Link href="/projects" className={styles.backButton}>
            Volver
          </Link>
          <button type="button" className={styles.editButton} onClick={handleEdit}>
            Editar
          </button>
        </div>
      </div>

      <div className={styles.twoColumnLayout}>
        {/* Columna izquierda */}
        <div className={styles.leftColumn}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Descripción</h2>
            <ProjectDescription project={project} />
          </div>

          <div className={styles.card}>
            <ProjectRequirementsSection projectId={project.id!} />
          </div>

          <div className={styles.card}>
            <ProjectObjectivesSection projectId={project.id!} />
          </div>
        </div>

        {/* Columna derecha */}
        <div className={styles.rightColumn}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Información general</h2>
            <ProjectGeneralInfo project={project} />
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Propiedades</h2>
            <ProjectProperties project={project} />
          </div>

          <ProjectAttachmentsSection projectId={id} />
        </div>
      </div>
    </div>
  );
}
