'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Badge, Button, ConfirmDialog, Loader } from '@/shared/components/ui';
import { useDocumentVersions } from '../../hooks/useDocumentVersions';
import { useRestoreVersion } from '../../hooks/useRestoreVersion';
import { formatDateTime } from '../../utils/dates';
import { prunedLabel, versionKindLabel } from '../../utils/documentLabels';
import { editorLabel } from '../../utils/editorLabel';
import { isLockActive, lockHolderLabel } from '../../utils/lockState';
import { describeRestoreError } from '../../utils/versionErrors';
import { DocsNotice } from '../DocsNotice';
import styles from './VersionHistoryPanel.module.scss';
import type { DocsDocumentDetail } from '../../types/docs.types';

interface VersionHistoryPanelProps {
  readonly open: boolean;
  /** El documento vigente: de él salen la versión actual, la base de la restauración y el lock. */
  readonly doc: DocsDocumentDetail;
  /** Versión que la pantalla está mostrando (`?version=N`), si es una anterior. */
  readonly viewingVersion: number | null;
  readonly onClose: () => void;
}

const LOAD_FAILED_MESSAGE = 'No se pudo cargar el historial. Intentá de nuevo.';
const PROTECTED_NAME = 'Protegida: no se borra al compactar el historial';

// O-13. `<dialog>` nativo anclado a la derecha (DS gap aceptado `modal` drawer), con el armazón
// de foco de `ShareDocumentDialog`. O-02 (`ConfirmDialog`) va en un portal aparte para que su
// `Escape` no cierre también el panel.
export function VersionHistoryPanel({
  open,
  doc,
  viewingVersion,
  onClose,
}: VersionHistoryPanelProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const titleId = useId();
  const lockHelpId = useId();

  const versions = useDocumentVersions({ id: doc.id, enabled: open });
  const restore = useRestoreVersion(doc.id);
  const [target, setTarget] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const items = useMemo(
    () => versions.data?.pages.flatMap((page) => page.items) ?? [],
    [versions.data]
  );
  const locked = isLockActive(doc.lock, new Date(), null);
  const pruned = prunedLabel(doc.prunedVersionsCount);

  const handleClose = useCallback(() => {
    setTarget(null);
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousActiveElementRef.current = document.activeElement;
      dialog.showModal();
      titleRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = previousActiveElementRef.current;
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    // O-02 vive en otro `<dialog>`: su `Escape` no cierra el panel.
    if (
      event.key === 'Escape' &&
      (event.target as HTMLElement).closest('dialog') === dialogRef.current
    ) {
      handleClose();
    }
  };

  const view = (version: number) => {
    handleClose();
    router.push(`/docs/${doc.id}?version=${version}`);
  };

  const confirmRestore = () => {
    if (target === null || restore.isPending) return;
    const fromVersion = target;
    setErrorMessage(null);
    restore.mutate(
      { fromVersion, baseVersion: doc.version },
      {
        onSuccess: (data) => {
          setTarget(null);
          toast.success(`Restauraste la versión ${fromVersion} como versión ${data.version}.`);
          handleClose();
          if (viewingVersion !== null) router.replace(`/docs/${doc.id}`);
        },
        onError: (error) => {
          setTarget(null);
          setErrorMessage(describeRestoreError(error, fromVersion));
        },
      }
    );
  };

  const confirm = (
    <ConfirmDialog
      open={target !== null}
      title={`Restaurar la versión ${target ?? ''}`}
      body={`Se va a guardar una versión nueva con el contenido de la versión ${target ?? ''}. La versión actual no se pierde: queda en el historial.`}
      confirmLabel="Restaurar"
      cancelLabel="Cancelar"
      pending={restore.isPending}
      onConfirm={confirmRestore}
      onCancel={() => setTarget(null)}
    />
  );

  return (
    <>
      <dialog
        ref={dialogRef}
        className={styles.panel}
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
          <div className={styles.header}>
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
              <span aria-hidden="true">🕘</span>
              Historial de versiones
            </h2>
            <Button variant="secondary-dismiss" icon="✕" onClick={handleClose}>
              <span className={styles.srOnly}>Cerrar historial</span>
            </Button>
          </div>

          {errorMessage && <DocsNotice intent="error">{errorMessage}</DocsNotice>}

          <div className={styles.scroll}>
            {versions.isLoading && <Loader variant="block" label="Cargando versiones…" />}
            {versions.isError && <DocsNotice intent="error">{LOAD_FAILED_MESSAGE}</DocsNotice>}
            {locked && doc.lock && (
              <p id={lockHelpId} className={styles.help}>
                {`${lockHolderLabel(doc.lock)} lo está editando.`}
              </p>
            )}
            {!versions.isLoading && !versions.isError && (
              <ol className={styles.list}>
                {items.map((item) => {
                  const isCurrent = item.version === doc.version;
                  const restoringThis =
                    restore.isPending && restore.variables?.fromVersion === item.version;
                  return (
                    <li key={item.version} className={styles.entry}>
                      <div className={styles.entryHead}>
                        <span className={styles.number}>{`Versión ${item.version}`}</span>
                        {isCurrent && <Badge variant="outline" family="neutral" label="Actual" />}
                        {item.protected && (
                          <span role="group" aria-label={PROTECTED_NAME}>
                            <Badge variant="outline" family="neutral" label="Protegida" />
                          </span>
                        )}
                      </div>
                      <p className={styles.line}>
                        {editorLabel({
                          name: item.authorName,
                          sub: item.author,
                          currentUserSub: currentUser?.zitadelId ?? null,
                        })}
                        {' · '}
                        <span className={styles.mono}>{formatDateTime(item.createdAt)}</span>
                      </p>
                      <p className={styles.line}>
                        {versionKindLabel(item.kind)}
                        {item.message ? ` · “${item.message}”` : ''}
                      </p>
                      {!isCurrent && (
                        <div className={styles.actions}>
                          <Button
                            variant="secondary-nav"
                            icon="👁"
                            onClick={() => view(item.version)}
                          >
                            Ver
                          </Button>
                          <Button
                            variant="secondary-dismiss"
                            icon="↻"
                            disabled={locked || restoringThis}
                            loading={restoringThis}
                            ariaDescribedBy={locked ? lockHelpId : undefined}
                            onClick={() => setTarget(item.version)}
                          >
                            Restaurar
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {versions.hasNextPage && (
              <Button
                variant="secondary-dismiss"
                loading={versions.isFetchingNextPage}
                onClick={() => void versions.fetchNextPage()}
              >
                Ver versiones anteriores
              </Button>
            )}
          </div>

          {pruned && (
            <p className={styles.footer}>
              <span aria-hidden="true">ⓘ </span>
              {pruned}
            </p>
          )}
        </div>
      </dialog>
      {typeof document === 'undefined' ? confirm : createPortal(confirm, document.body)}
    </>
  );
}
