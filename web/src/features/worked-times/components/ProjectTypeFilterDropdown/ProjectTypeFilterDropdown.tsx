'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './ProjectTypeFilterDropdown.module.scss';
import type { ProjectType } from '@/features/projects/types/project.types';

interface ProjectTypeFilterDropdownProps {
  readonly value: ProjectType[];
  readonly onChange: (types: ProjectType[]) => void;
}

const PROJECT_TYPE_OPTIONS: readonly { label: string; value: ProjectType }[] = [
  { label: 'Comercial', value: 'comercial' },
  { label: 'Interno', value: 'interno' },
  { label: 'Investigación', value: 'investigacion' },
  { label: 'Propuesta', value: 'propuesta' },
];

export function ProjectTypeFilterDropdown({ value, onChange }: ProjectTypeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggleOption = useCallback(
    (type: ProjectType) => {
      if (value.includes(type)) {
        onChange(value.filter((t) => t !== type));
      } else {
        onChange([...value, type]);
      }
    },
    [value, onChange]
  );

  const buttonLabel = value.length > 0 ? `Tipo de proyecto (${value.length})` : 'Tipo de proyecto';

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        {buttonLabel}
        <span className={cn(styles.chevron, { [styles.chevronOpen]: isOpen })} aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && (
        <div className={styles.panel}>
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className={cn(styles.option)}>
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => handleToggleOption(option.value)}
                aria-label={option.label}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
