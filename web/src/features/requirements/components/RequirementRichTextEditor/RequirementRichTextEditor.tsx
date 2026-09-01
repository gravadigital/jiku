'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { uploadFile } from '@/features/attachments/services/attachmentsClientApi';
import { validateFile } from '@/features/attachments/utils/fileValidation';
import {
  RichTextEditor,
  type AttachmentMeta,
} from '@/shared/components/ui/RichTextEditor/RichTextEditor';
import styles from './RequirementRichTextEditor.module.scss';

interface RequirementRichTextEditorProps {
  readonly initialValue?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly ariaLabel?: string;
  readonly onChange?: (value: string) => void;
  readonly uploadError?: string;
  readonly onUploadError?: (error: string) => void;
  /** Notifica el progreso real del PUT del archivo en curso, 0-100. */
  readonly onUploadProgress?: (progress: number, fileName: string) => void;
  /** Avisa si hay una subida en curso, para que el consumidor bloquee el envío. */
  readonly onUploadingChange?: (uploading: boolean) => void;
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
  /**
   * Mueve el foco al primer campo de texto del editor. Agregado por S-048: la pantalla exige
   * llevar el foco al editor al entrar en modo edición (accesibilidad de detalle-requisito).
   */
  focus: () => void;
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
    onUploadProgress,
    onUploadingChange,
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
  const containerRef = useRef<HTMLDivElement>(null);
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
    focus: () => {
      containerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    },
  }));

  function handleChange(newValue: string) {
    setValue(newValue);
    setPendingAttachments((prev) =>
      prev.filter((a) => newValue.includes(`${a.resource === 'file' ? 'file' : 'attach'}:${a.id}`))
    );
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
      onUploadingChange?.(true);
      setUploadingMimeType(file.type);
      // El archivo existe por sí solo: no se ancla a ninguna entidad. El
      // vínculo se crea al guardar, mandando su `fileId` en `fileIds`.
      const fileId = await uploadFile(file, {
        onProgress: (progress) => onUploadProgress?.(progress, file.name),
      });
      const isImage = file.type.startsWith('image/');
      // Prefijo `file:` porque N es un `fileId`, no un id de vínculo.
      const placeholder = isImage ? `![file:${fileId}]` : `[file:${fileId}]`;

      setValue((prev) => prev + placeholder);
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: fileId,
          resource: 'file',
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
      ]);
    } catch (error) {
      onUploadError?.(
        error instanceof Error && error.message ? error.message : 'Error al subir el archivo'
      );
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      setUploadingMimeType('');
    }
  }

  return (
    <div
      ref={containerRef}
      className={className ? `${styles.container} ${className}` : styles.container}
      role="group"
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
