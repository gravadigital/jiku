import React from 'react';
import { getProjectStatus } from '@/shared/utils';
import styles from './ProjectGeneralInfo.module.scss';
import type { Project } from '@/shared/types';

interface ProjectGeneralInfoProps {
  readonly project: Project;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ProjectGeneralInfo({ project }: ProjectGeneralInfoProps) {
  return (
    <dl className={styles.grid}>
      <div className={styles.row}>
        <dt>Código</dt>
        <dd>{project.code}</dd>
      </div>
      <div className={styles.row}>
        <dt>Cliente</dt>
        <dd>{project.client?.name ?? 'No definido'}</dd>
      </div>
      <div className={styles.row}>
        <dt>Estado</dt>
        <dd>{getProjectStatus(project.status)}</dd>
      </div>

      <div className={styles.row}>
        <dt>Creado por</dt>
        <dd>{project.creator.name}</dd>
      </div>
      <div className={styles.row}>
        <dt>Fecha de inicio</dt>
        <dd>{formatDate(project.initDate)}</dd>
      </div>
      <div className={styles.row}>
        <dt>Fecha de cierre estimada</dt>
        <dd>{project.endDate ? formatDate(project.endDate) : 'No definida'}</dd>
      </div>
    </dl>
  );
}
