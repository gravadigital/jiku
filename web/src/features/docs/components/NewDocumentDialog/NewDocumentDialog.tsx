'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/shared/components/ui';
import { useCreateDocument } from '../../hooks/useCreateDocument';
import { describeCreateError } from '../../utils/docsErrors';
import { normalizeFileName, slugifyFileName } from '../../utils/slug';
import { newUlid } from '../../utils/ulid';
import { DocsNotice } from '../DocsNotice';
import styles from './NewDocumentDialog.module.scss';

interface NewDocumentDialogProps {
  readonly open: boolean;
  /** Sin carpeta: el módulo ubica el documento (alta desde `/docs`, REQ-021). */
  readonly folder?: { readonly id: string; readonly path: string };
  readonly onClose: () => void;
}

// O-11. `<dialog>` nativo con el mismo armazón y reglas de foco que `ConfirmDialog` (DS gap
// aceptado `modal`: un `Dialog` genérico sería el componente correcto).
export function NewDocumentDialog({ open, folder, onClose }: NewDocumentDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const titleId = useId();

  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  // Un reintento manual reusa el mismo `id`: tras un 504 el alta es idempotente (DD-8).
  const [documentId, setDocumentId] = useState('');

  const create = useCreateDocument();
  const { reset } = create;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousActiveElementRef.current = document.activeElement;
      setTitle('');
      setFileName('');
      setNameTouched(false);
      setDocumentId(newUlid());
      reset();
      dialog.showModal();
      // El foco inicial va en "Título", el primer campo del DOM (P-11).
      dialog.querySelector<HTMLInputElement>('input')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = previousActiveElementRef.current;
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  const handleTitle = (value: string) => {
    setTitle(value);
    if (!nameTouched) setFileName(slugifyFileName(value));
  };

  const handleName = (value: string) => {
    setNameTouched(true);
    setFileName(value);
    if (create.isError) reset();
  };

  const canCreate = fileName.trim() !== '' && !create.isPending;

  const submit = useCallback(() => {
    if (!canCreate) return;
    const cleanTitle = title.trim();
    create.mutate(
      {
        id: documentId,
        ...(folder ? { folderId: folder.id } : {}),
        fileName: normalizeFileName(fileName),
        content: cleanTitle ? `# ${cleanTitle}\n` : '',
      },
      {
        onSuccess: (data) => {
          onClose();
          router.push(`/docs/${data.id}?editar=1`);
        },
      }
    );
  }, [canCreate, create, documentId, fileName, folder, onClose, router, title]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
      event.preventDefault();
      submit();
    }
  };

  const failure = create.isError ? describeCreateError(create.error) : {};

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
        {folder && (
          <p className={styles.destination}>
            <span aria-hidden="true">▤</span>
            {`Se crea en ${folder.path}`}
          </p>
        )}
        <Input
          label="Título"
          placeholder="Guía de despliegue"
          value={title}
          onChange={handleTitle}
        />
        <div>
          <Input
            label="Nombre del archivo"
            placeholder="guia-de-despliegue.md"
            value={fileName}
            error={failure.field}
            onChange={handleName}
          />
          <p className={styles.hint}>
            Minúsculas, números y guiones. Si no termina en .md, se lo agregamos.
          </p>
        </div>
        {failure.notice && <DocsNotice intent="error">{failure.notice}</DocsNotice>}
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
