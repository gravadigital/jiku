import React from 'react';
import { getProjects } from '@/features/projects';
import { ProjectCard } from '../ProjectCard';
import styles from './ProjectsBoard.module.scss';
import type { Project, ProjectFilters } from '@/shared/types';

export async function ProjectsBoard({ filters }: { readonly filters: ProjectFilters }) {
  const projects = await getProjects(filters);

  return (
    <div className={styles.gridContainer}>
      {projects.length === 0 ? (
        <span className={styles.noProjects}>No hay proyectos que coincidan con estos filtros.</span>
      ) : (
        projects.map((project: Project) => {
          return (
            <div className={styles.projectItem} key={project.id}>
              <ProjectCard
                name={project.name}
                code={project.code}
                status={project.status}
                description={project.description}
                type={project.type}
                initDate={new Date(project.initDate)}
                endDate={new Date(project.endDate)}
                id={project.id}
                priority={project.priority}
                creator={project.creator}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
