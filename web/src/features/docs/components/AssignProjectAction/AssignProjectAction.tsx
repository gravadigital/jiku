'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Button, Loader } from '@/shared/components/ui';
import { useAssignProject } from '../../hooks/useAssignProject';
import { useSuggestedRelations } from '../../hooks/useSuggestedRelations';
import { assignErrorToast, assignSuccessMessage } from '../../utils/assignErrors';
import { ProjectPicker } from '../ProjectPicker';
import styles from './AssignProjectAction.module.scss';

interface AssignItem {
  readonly id: string;
  readonly version: number;
  readonly title: string;
}

const reasonId = (docId: string) => `suggested-reason-${docId}`;

const useCandidate = (docId: string) => {
  const query = useSuggestedRelations({ id: docId });
  // Un candidato solo de cliente (`projectId: null`) no sirve para asignar un proyecto.
  const candidate = query.data?.items.find((s) => s.projectId !== null);
  return { ...query, candidate };
};

/** "Sugerido: {proyecto}" bajo el título; el `reason` queda como ayuda accesible del botón. */
export function SuggestedProjectLine({ id }: { readonly id: string }) {
  const { candidate } = useCandidate(id);
  if (!candidate || candidate.projectId === null) return null;
  return (
    <span className={styles.suggested}>
      {`Sugerido: ${candidate.projectName ?? `#${candidate.projectId}`}`}
      <span id={reasonId(id)} className={styles.srOnly}>
        {candidate.reason}
      </span>
    </span>
  );
}

interface PickerSlotProps {
  readonly onPick: (id: number, name: string) => void;
  readonly onCancel: () => void;
}

// El `Select` del DS no expone `defaultOpen` ni `onClose`: se abre y se cierra desde afuera.
function PickerSlot({ onPick, onCancel }: PickerSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const pointerInsideRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    const control = containerRef.current?.querySelector<HTMLElement>('[role="combobox"]');
    control?.focus();
    control?.click();
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.picker}
      // Clickear una opción (no enfocable) saca el foco antes del click: sin esta marca el
      // picker se cerraría y la opción nunca se elegiría.
      onMouseDownCapture={() => {
        pointerInsideRef.current = true;
      }}
      onFocus={() => {
        pointerInsideRef.current = false;
      }}
      onBlur={(event) => {
        if (pointerInsideRef.current) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <ProjectPicker value={null} onChange={onPick} />
    </div>
  );
}

/** Última columna de "Sin proyecto": asigna el proyecto sugerido o abre el selector en la fila. */
export function AssignProjectAction({ item }: { readonly item: AssignItem }) {
  const { candidate, isLoading } = useCandidate(item.id);
  const assign = useAssignProject();
  const [picking, setPicking] = useState(false);
  const pending = assign.isPending;

  const run = async (projectId: number, projectName: string) => {
    setPicking(false);
    try {
      await assign.mutateAsync({ id: item.id, baseVersion: item.version, projectId });
      toast.success(assignSuccessMessage(projectName, item.title));
    } catch (error) {
      const { level, message } = assignErrorToast(error);
      toast[level](message);
    }
  };

  if (isLoading) return <Loader variant="inline" label="Cargando…" />;

  if (candidate && candidate.projectId !== null) {
    const projectId = candidate.projectId;
    return (
      <Button
        variant="secondary-dismiss"
        loading={pending}
        disabled={pending}
        ariaDescribedBy={reasonId(item.id)}
        onClick={() => void run(projectId, candidate.projectName ?? `#${projectId}`)}
      >
        Asignar sugerido
      </Button>
    );
  }

  if (picking && !pending) {
    return <PickerSlot onPick={(id, name) => void run(id, name)} onCancel={() => setPicking(false)} />;
  }

  return (
    <Button
      variant="secondary-dismiss"
      loading={pending}
      disabled={pending}
      onClick={() => setPicking(true)}
    >
      Asignar proyecto
    </Button>
  );
}
