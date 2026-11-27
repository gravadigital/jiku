import React from 'react';
import { Card } from '@/shared/components/ui';
import { visibilityLabel } from '../../utils/documentLabels';
import styles from './DocumentProperties.module.scss';
import type { DocsVisibility } from '../../types/docs.types';

interface DocumentPropertiesProps {
  readonly visibility: DocsVisibility;
  readonly version: number;
}

/** Sin ruta de almacenamiento: el documento ya no se ubica por carpetas. */
export function DocumentProperties({ visibility, version }: DocumentPropertiesProps) {
  return (
    <Card variant="panel" title="Propiedades" headingLevel="h2">
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt className={styles.term}>Visibilidad</dt>
          <dd className={styles.value}>{visibilityLabel(visibility)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>Versión</dt>
          <dd className={`${styles.value} ${styles.mono}`}>{version}</dd>
        </div>
      </dl>
    </Card>
  );
}
