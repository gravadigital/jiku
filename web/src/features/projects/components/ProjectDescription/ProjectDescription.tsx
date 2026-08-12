import React from 'react';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import styles from './ProjectDescription.module.scss';
import type { Project } from '@/shared/types';

interface ProjectDescriptionProps {
  readonly project: Project;
}

export function ProjectDescription({ project }: ProjectDescriptionProps) {
  return (
    <div className={styles.description}>
      {project.description ? (
        <MarkdownViewer content={project.description} />
      ) : (
        <span className={styles.empty}>Sin descripción</span>
      )}
    </div>
  );
}
