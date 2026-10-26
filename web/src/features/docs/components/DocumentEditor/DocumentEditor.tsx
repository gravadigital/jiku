'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button, Card, ConfirmDialog, Input } from '@/shared/components/ui';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { getDocument } from '../../services/docsApi';
import { codeOf } from '../../utils/docsErrors';
import {
  CURRENT_VERSION_FAILED_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  saveValidationMessage,
  savedMessage,
} from '../../utils/docsErrors';
import { unwrap } from '../../utils/docsResult';
import { lockedMessage } from '../../utils/lockState';
import { DocsNotice } from '../DocsNotice';
import { DocumentAttachZone } from '../DocumentAttachZone';
import { DocumentContent } from '../DocumentContent';
import styles from './DocumentEditor.module.scss';
import type { EditSession, LockBlocker } from '../../hooks/useEditSession';
import type { DocsDocumentDetail } from '../../types/docs.types';

const PREVIEW_DEBOUNCE_MS = 300;

interface Conflict {
  /** Versión de la que parte el próximo guardado (la actual del documento). */
  version: number;
  /** La versión ajena, para mostrarla al lado; `null` si no se pudo cargar. */
  current: DocsDocumentDetail | null;
}

interface DocumentEditorProps {
  readonly doc: DocsDocumentDetail;
  readonly session: EditSession;
  /** Hay un aviso de nivel superior (módulo caído) que tiene prioridad sobre los del editor. */
  readonly suppressNotices?: boolean;
  /** Se guardó o se descartó: vuelve a la lectura. */
  readonly onDone: () => void;
}

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export function DocumentEditor({
  doc,
  session,
  suppressNotices = false,
  onDone,
}: DocumentEditorProps) {
  const queryClient = useQueryClient();
  const save = useSaveDocument(doc.id);
  const currentUser = useCurrentUser();

  // ADR-011: borrador y versión base son estado de interfaz. NO se derivan del query del
  // documento: ese query se refresca (foco, invalidaciones) y cambiaría la base en plena edición.
  const [initialContent] = useState(doc.content ?? '');
  const [draft, setDraft] = useState(initialContent);
  const [baseVersion, setBaseVersion] = useState(doc.version);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [resolving, setResolving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState(initialContent);

  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingCursor = useRef<number | null>(null);

  const textarea = useCallback(() => containerRef.current?.querySelector('textarea') ?? null, []);

  const dirty = draft !== initialContent;

  // Foco al editor al entrar, con el cursor al final (así un adjunto sin posición previa va al final).
  useEffect(() => {
    const el = textarea();
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [textarea]);

  // Vista previa con debounce (300 ms).
  useEffect(() => {
    const timer = setTimeout(() => setPreview(draft), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  // Dejar el cursor justo detrás del enlace insertado.
  useEffect(() => {
    if (pendingCursor.current === null) return;
    const el = textarea();
    if (el) {
      el.focus();
      el.setSelectionRange(pendingCursor.current, pendingCursor.current);
      selectionRef.current = { start: pendingCursor.current, end: pendingCursor.current };
    }
    pendingCursor.current = null;
  }, [draft, textarea]);

  // Salir de la página con cambios sin guardar pide confirmación al navegador.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const rememberSelection = () => {
    const el = textarea();
    if (el) selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const handleDraft = (value: string) => {
    setDraft(value);
    if (validationError) setValidationError(null);
  };

  const insertAtCursor = (markdown: string) => {
    setDraft((prev) => {
      const known = selectionRef.current;
      const start = Math.min(known?.start ?? prev.length, prev.length);
      const end = Math.min(known?.end ?? prev.length, prev.length);
      pendingCursor.current = start + markdown.length;
      return prev.slice(0, start) + markdown + prev.slice(end);
    });
  };

  const handleConflict = async (currentVersion: number) => {
    setResolving(true);
    let current: DocsDocumentDetail | null = null;
    try {
      current = await queryClient.fetchQuery({
        queryKey: ['docs-document', doc.id],
        queryFn: async () => unwrap(await getDocument(doc.id)),
        staleTime: 0,
      });
    } catch {
      // No se pudo traer la versión ajena: el panel lo dice y el conflicto sigue siendo explícito.
    }
    setBaseVersion(current?.version ?? currentVersion);
    setConflict({ version: current?.version ?? currentVersion, current });
    setResolving(false);
  };

  const handleSave = () => {
    setValidationError(null);
    save.mutate(
      {
        baseVersion,
        content: draft,
        ...(session.sessionId ? { sessionId: session.sessionId } : {}),
        ...(message.trim() ? { message } : {}),
      },
      {
        onSuccess: (result) => {
          void session.release();
          const text = savedMessage(result.version, result.warnings);
          if (result.warnings?.includes('possible_secret_detected')) toast.warning(text);
          else toast.success(text);
          onDone();
        },
        onError: (error) => {
          const code = codeOf(error);
          const details = (error as { details?: Record<string, unknown> }).details;
          if (code === 'version_conflict') {
            // Nunca se reintenta solo: la persona decide guardar sobre la versión actual (CA-30).
            const n = Number(details?.currentVersion);
            void handleConflict(Number.isFinite(n) ? n : baseVersion);
            return;
          }
          if (code === 'document_locked') {
            session.markBlocked((details ?? null) as LockBlocker | null);
            return;
          }
          const validation = saveValidationMessage(error);
          if (validation) {
            setValidationError(validation);
            return;
          }
          if (code === 'permission_denied') {
            toast.error(PERMISSION_DENIED_MESSAGE);
            setReadOnly(true);
            return;
          }
          toast.error(SAVE_FAILED_MESSAGE);
        },
      }
    );
  };

  const discard = async () => {
    setConfirmOpen(false);
    await session.release();
    onDone();
  };

  const handleCancel = () => {
    if (dirty) setConfirmOpen(true);
    else void discard();
  };

  // El nombre lo manda el servicio; "Otra persona" solo si no lo resuelve.
  const author = conflict?.current?.updatedByName?.trim() || 'Otra persona';

  const renderNotice = () => {
    if (suppressNotices) return null;
    if (conflict) {
      return (
        <DocsNotice intent="warning">
          {`${author} guardó la versión ${conflict.version} mientras editabas. Tu texto sigue acá: compará con la versión actual y guardá cuando estés listo.`}
        </DocsNotice>
      );
    }
    if (session.blockedBy) {
      return (
        <DocsNotice intent="info">{lockedMessage(session.blockedBy, currentUser?.id)}</DocsNotice>
      );
    }
    if (session.phase === 'lost') {
      return (
        <DocsNotice intent="warning">
          Se perdió la reserva de edición. Tu texto sigue acá; si nadie más lo tomó, vas a poder
          guardar igual.
        </DocsNotice>
      );
    }
    return null;
  };

  const saveLabel = conflict ? `Guardar sobre la versión ${conflict.version}` : 'Guardar';

  return (
    <div className={styles.editor}>
      {renderNotice()}

      <div className={styles.editRow}>
        <div className={styles.left}>
          {session.phase === 'editing' && !session.blockedBy && (
            <p className={styles.indicator}>
              <LockIcon />
              Lo estás editando. Nadie más puede guardar hasta que termines.
            </p>
          )}
          {/* Los eventos de selección burbujean: se recuerda la última posición del cursor porque
              al soltar un archivo en la zona de adjuntos el textarea pierde el foco. */}
          <div
            ref={containerRef}
            className={styles.textarea}
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onClick={rememberSelection}
            onBlur={rememberSelection}
            onInput={rememberSelection}
          >
            <Input
              variant="textarea"
              label="Contenido (markdown)"
              value={draft}
              disabled={readOnly}
              error={validationError ?? undefined}
              onChange={handleDraft}
            />
          </div>
          {!conflict && <DocumentAttachZone documentId={doc.id} onUploaded={insertAtCursor} />}
        </div>

        <div className={styles.right}>
          {conflict ? (
            <Card
              variant="panel"
              title={`Versión ${conflict.version}, guardada por ${author}`}
              headingLevel="h2"
            >
              {conflict.current ? (
                <pre className={styles.plain}>{conflict.current.content ?? ''}</pre>
              ) : (
                <p className={styles.muted}>{CURRENT_VERSION_FAILED_MESSAGE}</p>
              )}
            </Card>
          ) : (
            <Card variant="panel" title="Vista previa" headingLevel="h2">
              <DocumentContent content={preview} />
            </Card>
          )}
        </div>
      </div>

      <div className={styles.actionsRow}>
        <div className={styles.message}>
          <Input
            label="Qué cambiaste (opcional)"
            placeholder="Ej.: agrego los pasos de despliegue"
            value={message}
            onChange={setMessage}
          />
        </div>
        <div className={styles.buttons}>
          <Button variant="secondary-dismiss" onClick={handleCancel}>
            Cancelar
          </Button>
          {!readOnly && (
            <Button
              variant="primary"
              icon="✓"
              onClick={handleSave}
              loading={save.isPending || resolving}
              disabled={save.isPending || resolving}
            >
              {saveLabel}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Descartar cambios"
        body="Vas a perder lo que escribiste desde la última vez que guardaste."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        onConfirm={() => void discard()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
