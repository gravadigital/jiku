import type { Project } from '../../types/project.types';
import styles from './ProjectCard.module.scss';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  function handleClick() {
    onSelect(project);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(project);
    }
  }

  return (
    <article
      className={styles.card}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Seleccionar proyecto ${project.name}`}
    >
      <h3 className={styles.name}>{project.name}</h3>
    </article>
  );
}
