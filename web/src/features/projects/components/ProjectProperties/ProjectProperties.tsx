import React from 'react';
import styles from './ProjectProperties.module.scss';
import type { Project } from '@/shared/types';

interface ProjectPropertiesProps {
  readonly project: Project;
}

function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ProjectProperties({ project }: ProjectPropertiesProps) {
  const entries = project.keyValuePairs
    ? Object.entries(project.keyValuePairs).filter(([, value]) => Boolean(value))
    : [];

  if (entries.length === 0) {
    return <p className={styles.empty}>Sin propiedades definidas</p>;
  }

  return (
    <dl className={styles.grid}>
      {entries.map(([key, value]) => (
        <div key={key} className={styles.row}>
          <dt>{formatKey(key)}</dt>
          <dd>
            {value.startsWith('http://') || value.startsWith('https://') ? (
              <a href={value} target="_blank" rel="noreferrer" className={styles.link}>
                Ver {formatKey(key).toLowerCase()}
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 10L10 2M10 2H5M10 2V7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
