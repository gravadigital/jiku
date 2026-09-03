'use client';

import React, { useId, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Accordion.module.scss';

type AccordionStatus = 'pending' | 'done';
type HeadingLevel = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface AccordionProps {
  /**
   * Nombre de la etapa, con el término de dominio. No indicar acá que está pendiente.
   * Acepta `ReactNode` (S-058): un consumidor de fila de datos (ícono + texto + cifra) puede
   * componer contenido rico en la cabecera sin dejar de usar el `<button>` real del componente.
   * El uso típico —un `string` simple— sigue siendo válido y es el recomendado por el spec.
   */
  readonly title: React.ReactNode;
  /** Marca de completitud. `pending`: «!» ámbar. `done`: «✓» verde. */
  readonly status?: AccordionStatus;
  /**
   * Oculta la marca de completitud y el eco accesible redundante. Pensado para consumidores
   * (S-058: filas expandibles de una tabla jerárquica) sin concepto de "pendiente/completo",
   * donde el propio `title` (texto + ícono con `alt`) ya es su nombre accesible completo.
   */
  readonly showStatus?: boolean;
  readonly defaultExpanded?: boolean;
  readonly onToggle?: (expanded: boolean) => void;
  /** Nivel del heading que envuelve la cabecera. No se anidan acordeones. */
  readonly headingLevel?: HeadingLevel;
  readonly children: React.ReactNode;
}

const STATUS_LABEL: Record<AccordionStatus, string> = {
  pending: 'pendiente',
  done: 'completo',
};

const STATUS_GLYPH: Record<AccordionStatus, string> = {
  pending: '!',
  done: '✓',
};

export function Accordion({
  title,
  status = 'pending',
  showStatus = true,
  defaultExpanded = false,
  onToggle,
  headingLevel: Heading = 'h3',
  children,
}: AccordionProps) {
  const baseId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const headerId = `${baseId}-header`;
  const panelId = `${baseId}-panel`;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onToggle?.(next);
  };

  return (
    <div className={cn(styles.container, { [styles.expanded]: expanded })}>
      <Heading className={styles.headingWrapper}>
        <button
          id={headerId}
          type="button"
          className={styles.header}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={handleToggle}
        >
          {showStatus && (
            <span className={cn(styles.mark, styles[status])} aria-hidden="true">
              {STATUS_GLYPH[status]}
            </span>
          )}
          <span className={styles.title}>{title}</span>
          {showStatus && typeof title === 'string' && (
            <span className={styles.srOnly}>
              {title}, {STATUS_LABEL[status]}
            </span>
          )}
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={styles.panel}
        hidden={!expanded}
      >
        {children}
      </div>
    </div>
  );
}
