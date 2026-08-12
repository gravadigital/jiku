import React from 'react';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { SectionCard } from '@/shared/components/ui';
import { getProjectStatus } from '@/shared/utils';
import { ProjectPriorityTag } from '../ProjectPriorityTag';
import { ProjectTypeTag } from '../ProjectTypeTag';
import styles from './ProjectDetails.module.scss';
import type { Project } from '@/shared/types';

interface ProjectDetailsProps {
  readonly project: Project;
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
  const links = project.keyValuePairs
    ? Object.entries(project.keyValuePairs).filter(([_key, value]) => Boolean(value))
    : [];

  const propertyBox = (key: string, value: string) => {
    if (value.startsWith('http://')) {
      return (
        <a href={value} rel="noreferrer" target="_blank" className={styles.linkAnchor}>
          <span className={styles.linkIcon}>🔗</span>
          <span className={styles.linkText}>
            {`Ver ${key
              .split('_')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}`}
          </span>
        </a>
      );
    }
    return (
      <span>
        {key}
        {': '}
        {value}
      </span>
    );
  };

  return (
    <SectionCard>
      <div className={styles.detailSection}>
        <div className={styles.priorityTagContainer}>
          <ProjectPriorityTag value={project.priority} />
          <ProjectTypeTag value={project.type} />
        </div>
        <div className={styles.metadataGrid}>
          <div className={styles.leftColumn}>
            <p>
              <span>Código</span>
              {': '}
              {project.code}
            </p>

            <p>
              <span>Cliente</span>
              {': '}
              {project.client ? project.client.name : 'No definido'}
            </p>

            <p>
              <span>Estado</span>
              {': '}
              {getProjectStatus(project.status)}
            </p>
          </div>

          <div className={styles.rightColumn}>
            <p>
              <span>Creado por</span>
              {': '}
              {getProjectStatus(project.creator.name)}
            </p>

            <p>
              <span>Fecha de inicio</span>
              {': '}
              {new Date(project.initDate).toUTCString().slice(4, 16)}
            </p>

            <p>
              <span>Fecha de finalización estimada</span>
              {': '}
              {project.endDate
                ? new Date(project.endDate).toUTCString().slice(4, 16)
                : 'No definida'}
            </p>
          </div>
        </div>

        <h3 className={styles.descriptionTitle}>
          <span>Descripción</span>
        </h3>
        <div className={styles.markdownContainer}>
          {project.description ? <MarkdownViewer content={project.description} /> : 'No definida'}
        </div>

        <h3>
          <span>Propiedades:</span>
        </h3>
        <div className={styles.linksSection}>
          {links.length > 0 ? (
            links.map(([key, value]) => (
              <div key={key} className={styles.linkCard}>
                {propertyBox(key, value)}
              </div>
            ))
          ) : (
            <div className={styles.noLinks}>No hay links asociados</div>
          )}
        </div>
      </div>

      {/* Sección de etapas */}
    </SectionCard>
  );
}
