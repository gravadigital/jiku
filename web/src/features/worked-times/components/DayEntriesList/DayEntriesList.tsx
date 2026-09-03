'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useRequirements } from '@/features/requirements/hooks/useRequirements';
import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Loader } from '@/shared/components/ui/Loader';
import { TintedIcon } from '@/shared/components/ui/TintedIcon';
import objectivesLogo from '@root/assets/objetivosLogo.svg';
import projectsLogo from '@root/assets/proyectosLogo.svg';
import requirementsLogo from '@root/assets/requisitosLogo.svg';
import { useDeleteUnworkedTime } from '../../hooks/useDeleteUnworkedTime';
import { useDeleteWorkedTime } from '../../hooks/useDeleteWorkedTime';
import { usePersonObjectives } from '../../hooks/usePersonObjectives';
import { getUnworkedTimes } from '../../services/unworkedTimesApi';
import { getWorkedTimes } from '../../services/workedTimesApi';
import styles from './DayEntriesList.module.scss';
import type { ApiError } from '@/lib/axios';

interface DayEntriesListProps {
  readonly date: string;
  readonly personId: number;
}

const REASON_LABELS: Record<string, string> = {
  tramite: 'Trámite',
  corte_servicios: 'Corte de servicios',
  vacaciones: 'Vacaciones',
  dia_no_laborable: 'Día no laborable',
  personal: 'Personal',
  medico: 'Médico',
  estudio: 'Estudio',
  enfermedad: 'Enfermedad',
  otro: 'Otro',
};

const formatMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}min`;
};

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${day} ${months[date.getMonth()]}`;
};

export function DayEntriesList({ date, personId }: DayEntriesListProps) {
  const enabled = !!date && !!personId;

  const [workedTimesResult, unworkedTimesResult] = useQueries({
    queries: [
      {
        queryKey: ['worked-times', date, personId],
        queryFn: () => getWorkedTimes(date, personId),
        enabled,
      },
      {
        queryKey: ['unworked-times', date, personId],
        queryFn: () => getUnworkedTimes(date, personId),
        enabled,
      },
    ],
  });

  const isLoading = workedTimesResult.isLoading || unworkedTimesResult.isLoading;
  const workedEntries = useMemo(() => workedTimesResult.data ?? [], [workedTimesResult.data]);
  const unworkedEntries = useMemo(
    () => unworkedTimesResult.data ?? [],
    [unworkedTimesResult.data]
  );

  const { data: personObjectives = [] } = usePersonObjectives(personId);
  const { data: allRequirements = [] } = useRequirements({});

  const deleteWorkedMutation = useDeleteWorkedTime();
  const deleteUnworkedMutation = useDeleteUnworkedTime();

  const [deleteWorkedTargetId, setDeleteWorkedTargetId] = useState<number | null>(null);
  const [deleteUnworkedTargetId, setDeleteUnworkedTargetId] = useState<number | null>(null);

  const totalMinutes = useMemo(
    () =>
      workedEntries.reduce((sum, e) => sum + e.minutes, 0) +
      unworkedEntries.reduce((sum, e) => sum + e.minutes, 0),
    [workedEntries, unworkedEntries]
  );

  const hasEntries = workedEntries.length > 0 || unworkedEntries.length > 0;

  const handleConfirmDeleteWorked = () => {
    if (deleteWorkedTargetId === null) return;
    deleteWorkedMutation.mutate(deleteWorkedTargetId, {
      onSuccess: () => {
        toast.success('Registro eliminado');
        setDeleteWorkedTargetId(null);
      },
      onError: (error) => {
        const apiError = error as unknown as ApiError;
        toast.error(apiError.message || 'Error al eliminar');
        setDeleteWorkedTargetId(null);
      },
    });
  };

  const handleConfirmDeleteUnworked = () => {
    if (deleteUnworkedTargetId === null) return;
    deleteUnworkedMutation.mutate(deleteUnworkedTargetId, {
      onSuccess: () => {
        toast.success('Ausencia eliminada');
        setDeleteUnworkedTargetId(null);
      },
      onError: (error) => {
        const apiError = error as unknown as ApiError;
        toast.error(apiError.message || 'Error al eliminar ausencia');
        setDeleteUnworkedTargetId(null);
      },
    });
  };

  const getWorkedEntryLabel = (entry: (typeof workedEntries)[0]): string => {
    const projectName = entry.project?.name ?? 'Proyecto desconocido';
    const steps = ['Presente', projectName];

    if (entry.requirement) {
      steps.push(entry.requirement.title);
    } else if (entry.objective) {
      const personObjective = personObjectives.find((o) => o.id === entry.objective!.id);
      if (personObjective?.requirementId != null) {
        const requirement = allRequirements.find((r) => r.id === personObjective.requirementId);
        if (requirement) {
          steps.push(requirement.title);
        }
      }
      steps.push(entry.objective.title);
    }

    return steps.join(' → ');
  };

  const getWorkedEntryIcon = (
    entry: (typeof workedEntries)[0]
  ): { src: typeof projectsLogo; alt: string } => {
    if (entry.objective) {
      return { src: objectivesLogo, alt: 'Tarea' };
    }
    if (entry.requirement) {
      return { src: requirementsLogo, alt: 'Requisito' };
    }
    return { src: projectsLogo, alt: 'Proyecto' };
  };

  const isDeleting = deleteWorkedMutation.isPending || deleteUnworkedMutation.isPending;

  return (
    <Card>
      <div className={styles.header}>
        <span className={styles.title}>Cargas del {formatDateLabel(date)}</span>
        <span className={styles.total}>Total: {formatMinutes(totalMinutes)}</span>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <Loader />
        </div>
      )}

      {!isLoading && !hasEntries && (
        <EmptyState variant="scoped" message="No hay cargas para este día" />
      )}

      {!isLoading && hasEntries && (
        <ul className={styles.list}>
          {workedEntries.map((entry) => {
            const icon = getWorkedEntryIcon(entry);
            return (
              <li key={`worked-${entry.id}`} className={styles.entry}>
                <TintedIcon src={icon.src} alt={icon.alt} className={styles.entryIcon} />
                <span className={styles.entryLabel}>{getWorkedEntryLabel(entry)}</span>
                <span className={styles.entryMinutes}>{formatMinutes(entry.minutes)}</span>
                <Button
                  variant="secondary-dismiss"
                  onClick={() => setDeleteWorkedTargetId(entry.id)}
                  disabled={isDeleting}
                >
                  Borrar
                </Button>
              </li>
            );
          })}

          {unworkedEntries.map((entry) => (
            <li key={`unworked-${entry.id}`} className={styles.entry}>
              <span className={styles.entryLabel}>
                {`Ausente → ${REASON_LABELS[entry.reason] ?? entry.reason}`}
              </span>
              <span className={styles.entryMinutes}>{formatMinutes(entry.minutes)}</span>
              <Button
                variant="secondary-dismiss"
                onClick={() => setDeleteUnworkedTargetId(entry.id)}
                disabled={isDeleting}
              >
                Borrar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteWorkedTargetId !== null}
        title="Eliminar registro"
        body="Se va a eliminar este registro de horas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteWorked}
        onCancel={() => setDeleteWorkedTargetId(null)}
      />

      <ConfirmDialog
        open={deleteUnworkedTargetId !== null}
        title="Eliminar ausencia"
        body="Se va a eliminar este registro de ausencia. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteUnworked}
        onCancel={() => setDeleteUnworkedTargetId(null)}
      />
    </Card>
  );
}
