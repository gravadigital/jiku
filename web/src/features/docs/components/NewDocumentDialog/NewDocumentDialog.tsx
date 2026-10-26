'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button, Input } from '@/shared/components/ui';
import { useCanRestrictDocs } from '../../hooks/useCanRestrictDocs';
import { useCreateDocument } from '../../hooks/useCreateDocument';
import { TITLE_REQUIRED_MESSAGE, codeOf, describeCreateError } from '../../utils/docsErrors';
import { buildNewDocumentContent } from '../../utils/frontmatterDocument';
import { projectClientId, setPrincipal, type RelationValue } from '../../utils/relationFields';
import { newUlid } from '../../utils/ulid';
import { ClientProjectFields } from '../ClientProjectFields';
import { DocsNotice } from '../DocsNotice';
import { TopicsInput } from '../TopicsInput';
import { VisibilityField } from '../VisibilityField';
import styles from './NewDocumentDialog.module.scss';
import type { DocsVisibility } from '../../types/docs.types';

export interface NewDocumentInitial {
  clientId?: number;
  projectId?: number;
  requirement?: { id: number; title: string | null };
  task?: { id: number; title: string | null };
}

interface NewDocumentDialogProps {
  readonly open: boolean;
  /** Relaciones precargadas (filtro de origen de `/docs`, fichas de proyecto, requisito o tarea). */
  readonly initial?: NewDocumentInitial;
  readonly onClose: () => void;
}

const linkedLabel = (initial: NewDocumentInitial | undefined): string | null => {
  const entry = initial?.requirement
    ? { kind: 'Requisito', ...initial.requirement }
    : initial?.task
      ? { kind: 'Tarea', ...initial.task }
      : null;
  if (!entry) return null;
  return `También se vincula a: ${entry.kind}${entry.title ? ` ${entry.title}` : ''} #${entry.id}`;
};

// O-11. `<dialog>` nativo con el mismo armazón y reglas de foco que `ConfirmDialog` (DS gap
// aceptado `modal`: un `Dialog` genérico sería el componente correcto).
export function NewDocumentDialog({ open, initial, onClose }: NewDocumentDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const titleId = useId();
  const titleFieldRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [relations, setRelations] = useState<RelationValue>({ clients: [], projects: [] });
  const [topics, setTopics] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<DocsVisibility>('internal');
  // Un reintento manual reusa el mismo `id`: tras un 504 el alta es idempotente (DD-8).
  const [documentId, setDocumentId] = useState('');
  const [clientPending, setClientPending] = useState(false);

  const canRestrict = useCanRestrictDocs();
  const { data: projects } = useProjects();
  const create = useCreateDocument();
  const { reset } = create;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousActiveElementRef.current = document.activeElement;
      setTitle('');
      setTitleError(false);
      setTopics([]);
      setVisibility('internal');
      setRelations({
        clients: initial?.clientId === undefined ? [] : [initial.clientId],
        projects: initial?.projectId === undefined ? [] : [initial.projectId],
      });
      // Si llega el proyecto sin su cliente, se completa cuando `useProjects` lo trae.
      setClientPending(initial?.projectId !== undefined && initial.clientId === undefined);
      setDocumentId(newUlid());
      reset();
      dialog.showModal();
      // El foco inicial va en "Título", el primer campo del DOM (P-11).
      dialog.querySelector<HTMLInputElement>('input')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initial, reset]);

  useEffect(() => {
    if (!clientPending || !projects) return;
    setClientPending(false);
    setRelations((current) => {
      const id = current.projects[0];
      const project = id === undefined ? undefined : projects.find((p) => p.id === id);
      const clientOfProject = project === undefined ? null : projectClientId(project);
      return clientOfProject === null
        ? current
        : { ...current, clients: setPrincipal(current.clients, clientOfProject) };
    });
  }, [clientPending, projects]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = previousActiveElementRef.current;
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  const touched = () => {
    if (create.isError) reset();
  };

  const canCreate = title.trim() !== '' && !create.isPending;

  // Navegar primero y cerrar después: así la vista toma la reserva con el diálogo todavía montado
  // y el documento queda en edición sin recarga (bug de "Crear y editar").
  const goToEditor = useCallback(
    (id: string) => {
      router.push(`/docs/${id}?editar=1`);
      onClose();
    },
    [router, onClose]
  );

  const submit = useCallback(() => {
    if (title.trim() === '') {
      setTitleError(true);
      return;
    }
    if (create.isPending) return;
    create.mutate(
      {
        id: documentId,
        content: buildNewDocumentContent({
          title: title.trim(),
          visibility,
          topics,
          clients: relations.clients,
          projects: relations.projects,
          requirements: initial?.requirement ? [initial.requirement.id] : [],
          tasks: initial?.task ? [initial.task.id] : [],
        }),
      },
      {
        onSuccess: (data) => goToEditor(data.id),
        // Con el `id` propio, "ya existe" es el intento anterior (tras un 504) que sí se aplicó.
        onError: (error) => {
          if (codeOf(error) === 'already_exists') goToEditor(documentId);
        },
      }
    );
  }, [create, documentId, goToEditor, initial, relations, title, topics, visibility]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (
      event.key === 'Enter' &&
      !event.defaultPrevented &&
      // Solo Enter en "Título": los selectores y temas resuelven su propio Enter.
      event.target === titleFieldRef.current?.querySelector('input')
    ) {
      event.preventDefault();
      submit();
    }
  };

  const failure = create.isError ? describeCreateError(create.error) : null;
  const linked = linkedLabel(initial);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      onKeyDown={handleKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.content}>
        <h2 id={titleId} className={styles.title}>
          Nuevo documento
        </h2>
        <div ref={titleFieldRef}>
          <Input
            label="Título"
            placeholder="Ej.: Guía de despliegue"
            value={title}
            error={titleError && title.trim() === '' ? TITLE_REQUIRED_MESSAGE : undefined}
            onChange={(value) => {
              setTitle(value);
              touched();
            }}
          />
        </div>
        <ClientProjectFields
          layout="row"
          value={relations}
          onChange={(next) => {
            setRelations(next);
            touched();
          }}
        />
        {linked && (
          <p className={styles.linked}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            {linked}
          </p>
        )}
        <TopicsInput
          value={topics}
          onChange={(next) => {
            setTopics(next);
            touched();
          }}
        />
        <VisibilityField
          value={visibility}
          canRestrict={canRestrict}
          onChange={(next) => {
            setVisibility(next);
            touched();
          }}
          error={failure?.target === 'visibility' ? failure.notice : undefined}
        />
        {failure?.target === 'form' && <DocsNotice intent="error">{failure.notice}</DocsNotice>}
        <div className={styles.actions}>
          <Button variant="secondary-dismiss" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!canCreate}
            loading={create.isPending}
          >
            Crear y editar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
