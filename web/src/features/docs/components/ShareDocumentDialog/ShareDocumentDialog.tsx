'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, Input, Select, ToggleGroup } from '@/shared/components/ui';
import { useCreateShare } from '../../hooks/useCreateShare';
import { displayTitle } from '../../utils/paths';
import { describeCreateShareError } from '../../utils/shareErrors';
import { DEFAULT_SHARE_EXPIRY, SHARE_EXPIRY_OPTIONS } from '../../utils/shares';
import { DocsNotice } from '../DocsNotice';
import { ShareLinksTable } from '../ShareLinksTable';
import styles from './ShareDocumentDialog.module.scss';
import type { DocsDocumentDetail, ShareExpiryDays } from '../../types/docs.types';

interface ShareDocumentDialogProps {
  readonly open: boolean;
  readonly doc: DocsDocumentDetail;
  readonly onClose: () => void;
}

type View = 'default' | 'secret' | 'blocked' | 'created';

const ATTACHMENT_OPTIONS = [
  { value: 'include', label: 'Incluir adjuntos' },
  { value: 'text', label: 'Solo el texto' },
];
const COPIED_MS = 2000;

const BLOCKED_MESSAGE = 'La carpeta de este documento no permite compartirlo fuera de Jiku.';
const SECRET_MESSAGE =
  'Este documento parece contener una clave o un token. Si lo compartís, cualquiera con el link lo va a poder leer.';
const CREATED_MESSAGE = 'Copiá el link ahora: por seguridad, no lo vas a poder volver a ver.';

// O-12. `<dialog>` nativo con el armazón de `NewDocumentDialog` (DS gap aceptado `modal`).
// P-3: la `url` del 201 vive solo en el `useState` de este componente y se borra al cerrar.
export function ShareDocumentDialog({ open, doc, onClose }: ShareDocumentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkWrapRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();

  const [view, setView] = useState<View>('default');
  const [expiry, setExpiry] = useState(DEFAULT_SHARE_EXPIRY);
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState('include');
  const [url, setUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useCreateShare(doc.id);
  const { reset } = create;
  const sharingBlocked = doc.folder.sharingBlocked;

  const clearCopiedTimer = useCallback(() => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = null;
  }, []);

  // P-15: al cerrar se descarta todo, incluida la URL (P-3).
  const discard = useCallback(() => {
    clearCopiedTimer();
    setUrl(null);
    setNotice(null);
    setFieldError(null);
    setCopied(false);
    setView('default');
    setExpiry(DEFAULT_SHARE_EXPIRY);
    setNote('');
    setAttachments('include');
    reset();
  }, [clearCopiedTimer, reset]);

  const handleClose = useCallback(() => {
    discard();
    onClose();
  }, [discard, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousActiveElementRef.current = document.activeElement;
      discard();
      setView(sharingBlocked ? 'blocked' : 'default');
      dialog.showModal();
      const initial = sharingBlocked
        ? (dialog.querySelector<HTMLElement>('table button') ??
          dialog.querySelector<HTMLElement>('[data-close] button'))
        : dialog.querySelector<HTMLElement>('[role="combobox"]');
      initial?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // `sharingBlocked` se lee solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = previousActiveElementRef.current;
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  // P-3: al desmontar no queda ni la URL ni el resultado de la mutación.
  useEffect(
    () => () => {
      clearCopiedTimer();
      reset();
    },
    [clearCopiedTimer, reset]
  );

  useEffect(() => {
    if (view === 'created') linkWrapRef.current?.querySelector('input')?.focus();
  }, [view]);

  const submit = (acknowledge: boolean) => {
    if (create.isPending) return;
    setNotice(null);
    setFieldError(null);
    create.mutate(
      {
        expiresInDays: Number(expiry) as ShareExpiryDays,
        includeAttachments: attachments === 'include',
        note: note.trim() || undefined,
        ...(acknowledge ? { acknowledgeSecretWarning: true } : {}),
      },
      {
        onSuccess: (data) => {
          setUrl(data.url);
          setView('created');
        },
        onError: (error) => {
          const failure = describeCreateShareError(error);
          if (failure.state) setView(failure.state);
          if (failure.field) setFieldError(failure.field);
          if (failure.notice) setNotice(failure.notice);
        },
      }
    );
  };

  const selectLink = () => {
    const input = linkWrapRef.current?.querySelector('input');
    if (!input) return;
    input.focus();
    input.select();
  };

  const copy = async () => {
    if (!url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearCopiedTimer();
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // P-12: sin portapapeles, se deja el texto seleccionado para un Ctrl+C.
      selectLink();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    // O-02 (`ConfirmDialog`) vive en otro `<dialog>`: su `Escape` no cierra este (P-11).
    if (
      event.key === 'Escape' &&
      (event.target as HTMLElement).closest('dialog') === dialogRef.current
    ) {
      handleClose();
    }
  };

  const created = view === 'created';
  const blocked = view === 'blocked';
  const showForm = !created && !blocked;

  const renderNotice = () => {
    if (view === 'blocked') {
      return (
        <DocsNotice intent="info" role={sharingBlocked ? 'none' : 'alert'}>
          {BLOCKED_MESSAGE}
        </DocsNotice>
      );
    }
    if (view === 'secret') return <DocsNotice intent="warning">{SECRET_MESSAGE}</DocsNotice>;
    if (created) {
      return (
        <DocsNotice intent="success" role="status">
          {CREATED_MESSAGE}
        </DocsNotice>
      );
    }
    if (notice) return <DocsNotice intent="error">{notice}</DocsNotice>;
    return null;
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      onKeyDown={handleKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
    >
      <div className={styles.content}>
        <h2 id={titleId} className={styles.title}>
          <span aria-hidden="true">↗</span>
          {`Compartir «${displayTitle(doc)}»`}
        </h2>
        {!created && (
          <p className={styles.explanation}>
            Cualquiera que tenga el link va a poder leer la última versión del documento, sin
            iniciar sesión, hasta que venza o lo revoques.
          </p>
        )}
        {renderNotice()}

        {created && url && (
          <div className={styles.grid}>
            <div
              ref={linkWrapRef}
              className={styles.linkField}
              onFocusCapture={(e) => {
                if (e.target instanceof HTMLInputElement) e.target.select();
              }}
            >
              <Input variant="locked" label="Link" value={url} onChange={() => undefined} />
            </div>
            <div className={styles.linkAction}>
              <Button variant="primary" icon={copied ? '✓' : undefined} onClick={() => void copy()}>
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <span className={styles.liveRegion} aria-live="polite">
              {copied ? 'Copiado' : ''}
            </span>
          </div>
        )}

        {showForm && (
          <>
            <div className={styles.grid}>
              <div className={styles.expiry}>
                <Select
                  label="Vence en"
                  options={SHARE_EXPIRY_OPTIONS}
                  value={expiry}
                  error={fieldError ?? undefined}
                  onChange={(value) => {
                    setExpiry(value);
                    setFieldError(null);
                  }}
                />
              </div>
              <div className={styles.note}>
                <Input
                  label="Nota (opcional)"
                  placeholder="Ej.: para el equipo de soporte de ACME"
                  value={note}
                  onChange={setNote}
                />
              </div>
            </div>
            <div className={styles.attachments}>
              <span className={styles.attachmentsLabel} aria-hidden="true">
                Adjuntos
              </span>
              <ToggleGroup
                variant="segmented"
                label="Adjuntos"
                options={ATTACHMENT_OPTIONS}
                value={attachments}
                onChange={setAttachments}
              />
            </div>
            <div className={styles.row}>
              {view === 'secret' ? (
                <Button
                  variant="primary"
                  loading={create.isPending}
                  disabled={create.isPending}
                  onClick={() => submit(true)}
                >
                  Compartir igual
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="⛓"
                  loading={create.isPending}
                  disabled={create.isPending}
                  onClick={() => submit(false)}
                >
                  Crear link
                </Button>
              )}
            </div>
          </>
        )}

        <ShareLinksTable documentId={doc.id} enabled={open} />

        <div className={styles.row}>
          <span data-close="">
            <Button variant="secondary-dismiss" onClick={handleClose}>
              Cerrar
            </Button>
          </span>
        </div>
      </div>
    </dialog>
  );
}
