'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { uploadAttachments } from '@/features/attachments/services/attachmentsClientApi';
import { validateFile } from '@/features/attachments/utils/fileValidation';
import {
  RichTextEditor,
  type AttachmentMeta,
} from '@/shared/components/ui/RichTextEditor/RichTextEditor';
import styles from './RequirementRichTextEditor.module.scss';
import type { EntityType } from '@/features/attachments/types/attachment.types';

interface RequirementRichTextEditorProps {
  readonly initialValue?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly ariaLabel?: string;
  readonly onChange?: (value: string) => void;
  readonly uploadError?: string;
  readonly onUploadError?: (error: string) => void;
  /** Entidad a la que se ancla el adjunto subido. Default: 'requirement_draft' (descripción, sin entidad aún creada). */
  readonly entityType?: EntityType;
  /** ID de la entidad, o null si aún no existe (ej. requirement_draft antes de crear el requisito). Default: null. */
  readonly entityId?: number | null;
  /** Clase CSS adicional aplicada al contenedor raíz, para ajustar layout/alto según el contexto de uso. */
  readonly className?: string;
  /**
   * Muestra el botón "Adjuntar" propio en la toolbar interna. Default: true.
   * Poner en false cuando el consumidor prefiere su propio botón externo y
   * dispara la selección de archivo vía el handle (openFilePicker).
   */
  readonly showToolbar?: boolean;
}

export interface RequirementRichTextEditorHandle {
  getValue: () => string;
  clear: () => void;
  /** Abre el selector de archivos del sistema operativo (equivalente a click en "Adjuntar"). */
  openFilePicker: () => void;
}

export const RequirementRichTextEditor = forwardRef<
  RequirementRichTextEditorHandle,
  RequirementRichTextEditorProps
>(function RequirementRichTextEditor(
  {
    initialValue = '',
    placeholder,
    disabled = false,
    ariaLabel,
    onChange,
    onUploadError,
    entityType = 'requirement_draft',
    entityId = null,
    className,
    showToolbar = true,
  },
  ref
) {
  const [value, setValue] = useState(initialValue);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingMimeType, setUploadingMimeType] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChange?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    clear: () => {
      setValue('');
      setPendingAttachments([]);
    },
    openFilePicker: () => {
      fileInputRef.current?.click();
    },
  }));

  function handleChange(newValue: string) {
    setValue(newValue);
    setPendingAttachments((prev) => prev.filter((a) => newValue.includes(`attach:${a.id}`)));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      onUploadError?.(validation.error ?? 'Archivo no válido');
      return;
    }

    try {
      setUploading(true);
      setUploadingMimeType(file.type);
      const [attachment] = await uploadAttachments(entityType, entityId, [file]);
      const isImage = attachment.mimeType.startsWith('image/');
      const placeholder = isImage ? `![attach:${attachment.id}]` : `[attach:${attachment.id}]`;

      setValue((prev) => prev + placeholder);
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
        },
      ]);
    } catch {
      onUploadError?.('Error al subir el archivo');
    } finally {
      setUploading(false);
      setUploadingMimeType('');
    }
  }

  return (
    <div
      className={className ? `${styles.container} ${className}` : styles.container}
      aria-label={ariaLabel}
    >
      <div className={`${styles.inputBox} rich-text-editor-input-box`}>
        <div className={`${styles.scrollArea} rich-text-editor-scroll-area`}>
          <RichTextEditor
            value={value}
            onChange={handleChange}
            attachmentMeta={pendingAttachments}
            placeholder={placeholder}
            disabled={disabled}
            uploading={uploading}
            uploadingMimeType={uploadingMimeType}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className={styles.fileInput}
          onChange={handleFileChange}
          aria-label="Adjuntar archivo"
        />
        {showToolbar && (
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              aria-label="Adjuntar archivo"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {uploading ? 'Subiendo...' : 'Adjuntar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
