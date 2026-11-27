'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, ConfirmDialog, EmptyState, Loader, Table } from '@/shared/components/ui';
import { useDocumentShares } from '../../hooks/useDocumentShares';
import { useRevokeShare } from '../../hooks/useRevokeShare';
import { formatDateTime } from '../../utils/dates';
import { revokeShareErrorMessage, SHARES_LOAD_FAILED_MESSAGE } from '../../utils/shareErrors';
import { shareDescription, shareStatusBadge } from '../../utils/shares';
import { DocsNotice } from '../DocsNotice';
import styles from './ShareLinksTable.module.scss';
import type { DocsShare } from '../../types/docs.types';

interface ShareLinksTableProps {
  readonly documentId: string;
  readonly enabled?: boolean;
}

const COLUMNS = [
  { key: 'estado', label: 'Estado' },
  { key: 'vence', label: 'Vence' },
  { key: 'nota', label: 'Nota' },
  { key: 'accesos', label: 'Accesos' },
  { key: 'ultimoAcceso', label: 'Último acceso' },
  { key: 'accion', label: 'Acción' },
];

// Lista de links de O-12 (`tabla-links`). Nunca muestra `url` ni `token` (CA-31): la api no los
// devuelve. La revocación abre O-02 (`ConfirmDialog`).
export function ShareLinksTable({ documentId, enabled = true }: ShareLinksTableProps) {
  const idPrefix = useId();
  const { data, isLoading, isError } = useDocumentShares({ documentId, enabled });
  const revoke = useRevokeShare(documentId);
  const [target, setTarget] = useState<DocsShare | null>(null);
  const [revokedId, setRevokedId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const statusRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const items = useMemo(() => data?.items ?? [], [data]);

  // P-10: tras revocar, el foco va a la celda de estado de esa fila ("Revocar" ya no existe).
  // Corre después del cleanup de `ConfirmDialog`, que intenta devolver el foco al botón desmontado.
  useEffect(() => {
    if (!revokedId) return;
    const row = items.find((item) => item.id === revokedId);
    if (row && row.status !== 'active') {
      statusRefs.current[revokedId]?.focus();
      setRevokedId(null);
    }
  }, [revokedId, items]);

  const confirmRevoke = () => {
    if (!target) return;
    const share = target;
    revoke.mutate(share.id, {
      onSuccess: () => {
        setTarget(null);
        setRevokedId(share.id);
      },
      onError: (error) => {
        setTarget(null);
        setRevokeError(revokeShareErrorMessage(error));
      },
    });
  };

  const openRevoke = (share: DocsShare) => {
    setRevokeError(null);
    setTarget(share);
  };

  const rows = items.map((share) => {
    const badge = shareStatusBadge(share);
    const descriptionId = `${idPrefix}-${share.id}`;
    return {
      estado: (
        <span
          ref={(node) => {
            statusRefs.current[share.id] = node;
          }}
          tabIndex={-1}
          className={styles.statusCell}
        >
          <Badge variant="state" family={badge.family} label={badge.label} />
        </span>
      ),
      vence: formatDateTime(share.expiresAt),
      nota: share.note ? <span className={styles.note}>{share.note}</span> : '—',
      accesos: String(share.accessCount ?? 0),
      ultimoAcceso: share.lastAccessAt ? formatDateTime(share.lastAccessAt) : 'Nunca',
      accion:
        share.status === 'active' ? (
          <>
            <Button
              variant="secondary-dismiss"
              ariaDescribedBy={descriptionId}
              onClick={() => openRevoke(share)}
            >
              Revocar
            </Button>
            <span id={descriptionId} className={styles.hidden}>
              {shareDescription(share)}
            </span>
          </>
        ) : null,
    };
  });

  let body: React.ReactNode;
  if (isLoading) {
    body = <Loader variant="inline" />;
  } else if (isError) {
    body = <DocsNotice intent="error">{SHARES_LOAD_FAILED_MESSAGE}</DocsNotice>;
  } else if (items.length === 0) {
    body = <EmptyState variant="list" message="Este documento todavía no tiene links." />;
  } else {
    body = (
      <Table variant="light" columns={COLUMNS} rows={rows} ariaLabel="Links de este documento" />
    );
  }

  // P-11: O-02 va como hermano de O-12 en `document.body`. Dentro del `<dialog>` de O-12 el
  // `Escape` cerraría los dos a la vez.
  const confirm = (
    <ConfirmDialog
      open={target !== null}
      title="Revocar link"
      body="Quien tenga este link va a dejar de poder abrir el documento. No se puede deshacer."
      confirmLabel="Revocar"
      cancelLabel="Cancelar"
      pending={revoke.isPending}
      onConfirm={confirmRevoke}
      onCancel={() => setTarget(null)}
    />
  );

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Links de este documento</h3>
      {revokeError && <DocsNotice intent="error">{revokeError}</DocsNotice>}
      {body}
      {typeof document === 'undefined' ? null : createPortal(confirm, document.body)}
    </section>
  );
}
