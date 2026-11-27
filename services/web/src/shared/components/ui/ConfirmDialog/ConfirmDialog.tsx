'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { Button } from '../Button';
import styles from './ConfirmDialog.module.scss';

interface ConfirmDialogProps {
  readonly open: boolean;
  /** La acción a confirmar — «Eliminar requisito». */
  readonly title: string;
  /** Qué se afecta y que es irreversible — nunca «¿Estás seguro?». */
  readonly body: string;
  /** El verbo de la acción — «Eliminar», nunca «Sí». */
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Confirmación en curso: deshabilita ambas acciones y pone el confirmar en carga. */
  readonly pending?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  pending = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousActiveElementRef.current = document.activeElement;
      dialog.showModal();
      // El foco inicial va en la acción menos destructiva (cancelar), no en
      // confirmar. `Button` no reenvía `ref` a su nodo DOM, así que se ubica el
      // primer botón del diálogo, que el orden del JSX pone en cancelar.
      dialog.querySelector<HTMLButtonElement>('button')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = previousActiveElementRef.current;
    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onCancel();
      }
    },
    [onCancel]
  );

  // El navegador dispara el evento nativo `cancel` al presionar Esc sobre un
  // <dialog> abierto con showModal(), que por default también lo cierra. El
  // polyfill de tests/setup.ts (necesario porque jsdom no implementa showModal)
  // no simula ese comportamiento nativo, así que se maneja acá también por
  // teclado explícito para que el cierre por Esc sea verificable en ambos
  // entornos sin depender de qué tan fiel sea el polyfill.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDialogElement>) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className={styles.content}>
        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>
        <p className={styles.body}>{body}</p>
        <div className={styles.actions}>
          <Button variant="secondary-dismiss" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant="secondary-dismiss"
            onClick={onConfirm}
            disabled={pending}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
