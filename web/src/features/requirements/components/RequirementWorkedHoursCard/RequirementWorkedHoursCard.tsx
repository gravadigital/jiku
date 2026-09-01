'use client';

import React from 'react';
import { Loader } from '@/shared/components/ui';
import { formatMinutes } from '@/shared/utils/format-minutes';
import { useRequirementWorkedHours } from '../../hooks/useRequirementWorkedHours';
import styles from './RequirementWorkedHoursCard.module.scss';

interface RequirementWorkedHoursCardProps {
  readonly reqid: number;
}

/**
 * Cuerpo del card "Horas Trabajadas" de la columna derecha del detalle. Pide sus propios datos
 * con una query TanStack Query independiente del requisito (S-045): se degrada sola si falla o
 * está cargando, sin afectar al resto de la pantalla (CA-8).
 *
 * El título de la card lo pone el componente que envuelve (`RequirementDetail`), como con
 * "Información General" y "Etiquetas": este componente solo aporta el cuerpo.
 */
export function RequirementWorkedHoursCard({ reqid }: RequirementWorkedHoursCardProps) {
  const { data, isLoading, isError } = useRequirementWorkedHours(reqid);

  if (isLoading) {
    return <Loader label="Cargando horas..." />;
  }

  // isError va antes que el vacío: sin esta distinción, una falla se ve como "Sin horas
  // cargadas" — un requisito con horas mostrando que no las tiene, el modo de falla peor.
  if (isError || !data) {
    return <p className={styles.errorText}>No se pudieron cargar las horas</p>;
  }

  if (data.byPerson.length === 0) {
    return <p className={styles.emptyText}>Sin horas cargadas</p>;
  }

  return (
    <div>
      <h3 className={styles.total}>{formatMinutes(data.totalMinutes)}</h3>
      <ul className={styles.breakdown}>
        {data.byPerson.map((person) => (
          <li key={person.personId} className={styles.breakdownRow}>
            <span>
              {person.firstName} {person.lastName}
            </span>
            <span>{formatMinutes(person.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
