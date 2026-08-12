import type { Project } from '../../types/project.types';
import { ProjectCard } from '../ProjectCard';
import styles from './ProjectList.module.scss';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

export function ProjectList({ projects, onSelectProject }: ProjectListProps) {
  return (
    <ul className={styles.list} role="list">
      {projects.map((project) => (
        <li key={project.id} className={styles.item}>
          <ProjectCard project={project} onSelect={onSelectProject} />
        </li>
      ))}
    </ul>
  );
}
