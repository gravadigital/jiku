import { ProjectCard } from '@/features/projects/components/ProjectCard';
import styles from './ClientProjects.module.scss';
import type { Project } from '@/features/projects/types/project.types';

interface ClientProjectsProps {
  readonly projects?: Project[];
}

export function ClientProjects({ projects }: ClientProjectsProps) {
  if (!projects || projects.length === 0) {
    return <div className={styles.empty}>No hay proyectos asociados.</div>;
  }

  return (
    <div className={styles.projectsGrid}>
      {projects.map((project) => (
        <div key={project.id} className={styles.projectItem}>
          <ProjectCard
            name={project.name}
            code={project.code}
            status={project.status}
            description={project.description}
            type={project.type}
            initDate={project.initDate}
            endDate={project.endDate ?? project.initDate}
            id={project.id}
            priority={project.priority}
            creator={project.creator}
          />
        </div>
      ))}
    </div>
  );
}
