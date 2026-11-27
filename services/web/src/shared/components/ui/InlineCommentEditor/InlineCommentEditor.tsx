'use client';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AttachmentPlaceholder } from '@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder';
import styles from './InlineCommentEditor.module.scss';

export type ChipKind = 'image' | 'file';

export interface ChipRenderInfo {
  readonly id: number;
  readonly kind: ChipKind;
  readonly fileName?: string;
}

interface ChipInfo {
  readonly id: number;
  readonly kind: ChipKind;
  readonly fileName?: string;
  readonly element: HTMLElement;
}

interface InlineCommentEditorProps {
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly onChange?: (markdown: string) => void;
  readonly ariaLabel?: string;
  /**
   * Límite opcional sobre el markdown serializado (texto + placeholders).
   * Las inserciones de adjunto que harían superar el límite se rechazan.
   */
  readonly maxLength?: number;
  /**
   * Render personalizado del contenido de cada chip. Si no se provee,
   * se usa `AttachmentPlaceholder`.
   */
  readonly renderChip?: (info: ChipRenderInfo) => React.ReactNode;
  /**
   * Clase CSS adicional aplicada al nodo host de cada chip. Útil para que el
   * consumidor controle el `display` del chip (p. ej. block para que ocupe su
   * propia línea) sin alterar el estilo por defecto.
   */
  readonly chipClassName?: string;
}

export interface InlineCommentEditorHandle {
  getValue: () => string;
  clear: () => void;
  /** Inserta un chip en el cursor. Retorna false si excedería `maxLength`. */
  insertAttachment: (attachmentId: number, kind: ChipKind, fileName?: string) => boolean;
  /** Elimina del editor todos los chips del adjunto indicado. */
  removeAttachment: (attachmentId: number) => void;
  focus: () => void;
}

const ATTR_ID = 'data-attachment-id';
const ATTR_KIND = 'data-attachment-kind';
const ATTR_NAME = 'data-attachment-name';
const ATTR_KEY = 'data-chip-key';

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  const el = node as HTMLElement;
  if (el.hasAttribute(ATTR_ID)) {
    const id = el.getAttribute(ATTR_ID);
    const kind = el.getAttribute(ATTR_KIND);
    return kind === 'image' ? `![attach:${id}]` : `[attach:${id}]`;
  }
  if (el.tagName === 'BR') {
    return '\n';
  }
  const inner = Array.from(el.childNodes).map(serializeNode).join('');
  if (el.tagName === 'DIV' || el.tagName === 'P') {
    return `\n${inner}`;
  }
  return inner;
}

function serializeEditor(root: HTMLElement): string {
  const parts = Array.from(root.childNodes).map(serializeNode).join('');
  return parts.replace(/^\n+/, '');
}

function placeholderFor(attachmentId: number, kind: ChipKind): string {
  return kind === 'image' ? `![attach:${attachmentId}]` : `[attach:${attachmentId}]`;
}

function insertAtCursor(container: HTMLElement, chip: HTMLElement, space: Text): void {
  const selection = window.getSelection();
  const hasCursorInside =
    selection && selection.rangeCount > 0 && container.contains(selection.anchorNode);

  if (hasCursorInside) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(space);
    range.insertNode(chip);
  } else {
    container.appendChild(chip);
    container.appendChild(space);
  }
  const newRange = document.createRange();
  newRange.setStartAfter(space);
  newRange.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(newRange);
}

export const InlineCommentEditor = forwardRef<InlineCommentEditorHandle, InlineCommentEditorProps>(
  function InlineCommentEditor(
    { placeholder, disabled = false, onChange, ariaLabel, maxLength, renderChip, chipClassName },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [chips, setChips] = useState<Map<string, ChipInfo>>(new Map());
    const [isEmpty, setIsEmpty] = useState(true);

    const notifyChange = useCallback(() => {
      if (!editorRef.current) return;
      const value = serializeEditor(editorRef.current);
      setIsEmpty(value.length === 0);
      onChange?.(value);
    }, [onChange]);

    const syncChipsWithDom = useCallback(() => {
      if (!editorRef.current) return;
      const remaining = new Set<string>();
      editorRef.current.querySelectorAll(`[${ATTR_KEY}]`).forEach((el) => {
        const key = el.getAttribute(ATTR_KEY);
        if (key) remaining.add(key);
      });
      setChips((prev) => {
        if (prev.size === remaining.size) {
          let allPresent = true;
          prev.forEach((_, key) => {
            if (!remaining.has(key)) allPresent = false;
          });
          if (allPresent) return prev;
        }
        const next = new Map<string, ChipInfo>();
        prev.forEach((value, key) => {
          if (remaining.has(key)) next.set(key, value);
        });
        return next;
      });
    }, []);

    const handleInput = useCallback(() => {
      syncChipsWithDom();
      notifyChange();
    }, [notifyChange, syncChipsWithDom]);

    const handleBeforeInput = useCallback(
      (e: React.FormEvent<HTMLDivElement> & { nativeEvent: InputEvent }) => {
        if (maxLength === undefined || !editorRef.current) return;
        const native = e.nativeEvent;
        // Solo bloqueamos inserciones que agregan contenido.
        const inserted = native.data ?? '';
        if (inserted.length === 0) return;
        const current = serializeEditor(editorRef.current).length;
        if (current + inserted.length > maxLength) {
          e.preventDefault();
        }
      },
      [maxLength]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement('br');
          range.insertNode(br);
          const placeholderNode = document.createTextNode('\u200B');
          br.after(placeholderNode);
          const newRange = document.createRange();
          newRange.setStartAfter(br);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          handleInput();
        }
      },
      [handleInput]
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        let text = e.clipboardData.getData('text/plain');
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
        if (maxLength !== undefined) {
          const current = serializeEditor(editorRef.current).length;
          const room = maxLength - current;
          if (room <= 0) return;
          if (text.length > room) text = text.slice(0, room);
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        handleInput();
      },
      [handleInput, maxLength]
    );

    useImperativeHandle(
      ref,
      () => ({
        getValue: () => (editorRef.current ? serializeEditor(editorRef.current) : ''),
        clear: () => {
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
          }
          setChips(new Map());
          setIsEmpty(true);
          onChange?.('');
        },
        insertAttachment: (attachmentId, kind, fileName) => {
          if (!editorRef.current) return false;
          if (maxLength !== undefined) {
            const current = serializeEditor(editorRef.current).length;
            // El chip serializa al placeholder + un espacio que insertamos junto a él.
            const cost = placeholderFor(attachmentId, kind).length + 1;
            if (current + cost > maxLength) {
              return false;
            }
          }
          const selection = window.getSelection();
          const hadCursorInside =
            selection &&
            selection.rangeCount > 0 &&
            editorRef.current.contains(selection.anchorNode);
          if (!hadCursorInside) {
            editorRef.current.focus();
          }
          const chipKey = `chip-${attachmentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const chip = document.createElement('span');
          chip.setAttribute(ATTR_KEY, chipKey);
          chip.setAttribute(ATTR_ID, String(attachmentId));
          chip.setAttribute(ATTR_KIND, kind);
          if (fileName) chip.setAttribute(ATTR_NAME, fileName);
          chip.setAttribute('contenteditable', 'false');
          chip.className = chipClassName ? `${styles.chip} ${chipClassName}` : styles.chip;
          const space = document.createTextNode(' ');
          insertAtCursor(editorRef.current, chip, space);
          setChips((prev) => {
            const next = new Map(prev);
            next.set(chipKey, { id: attachmentId, kind, fileName, element: chip });
            return next;
          });
          notifyChange();
          return true;
        },
        removeAttachment: (attachmentId) => {
          if (!editorRef.current) return;
          editorRef.current
            .querySelectorAll(`[${ATTR_ID}="${attachmentId}"]`)
            .forEach((el) => el.remove());
          syncChipsWithDom();
          notifyChange();
        },
        focus: () => {
          editorRef.current?.focus();
        },
      }),
      [notifyChange, onChange, maxLength, syncChipsWithDom, chipClassName]
    );

    useEffect(() => {
      return () => {
        setChips(new Map());
      };
    }, []);

    return (
      <div className={styles.wrapper}>
        <div
          ref={editorRef}
          role="textbox"
          aria-label={ariaLabel}
          aria-multiline="true"
          aria-disabled={disabled}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className={styles.editor}
          data-placeholder={placeholder ?? ''}
          data-empty={isEmpty ? 'true' : 'false'}
          onBeforeInput={handleBeforeInput}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        {Array.from(chips.entries()).map(([key, info]) =>
          createPortal(
            renderChip ? (
              renderChip({ id: info.id, kind: info.kind, fileName: info.fileName })
            ) : (
              <AttachmentPlaceholder attachmentId={info.id} fileName={info.fileName} />
            ),
            info.element,
            key
          )
        )}
      </div>
    );
  }
);
