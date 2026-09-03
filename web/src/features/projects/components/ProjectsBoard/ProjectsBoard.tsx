import React from 'react';
import { getProjects } from '@/features/projects';
import { EmptyState } from '@/shared/components/ui';
import { ProjectCard } from '../ProjectCard';
import styles from './ProjectsBoard.module.scss';
import type { Project, ProjectFilters } from '@/shared/types';

export async function ProjectsBoard({ filters }: { readonly filters: ProjectFilters }) {
  const projects = await getProjects(filters);
  const hasActiveFilters = Boolean(filters.search || filters.type || (filters.state && filters.state !== 'activo'));

  return (
    <div className={styles.gridContainer}>
      {projects.length === 0 ? (
        <EmptyState
          variant={hasActiveFilters ? 'filtered' : 'list'}
          message={
            hasActiveFilters
              ? 'No hay proyectos que coincidan con estos filtros.'
              : 'Todavía no hay proyectos.'
          }
          action={hasActiveFilters ? undefined : { children: 'Nuevo proyecto', href: '/projects/new' }}
        />
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
