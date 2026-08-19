'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip } from 'lucide-react';
import { useActiveProject } from '@/contexts/ProjectContext';
import { useCreateRequirement } from '../../hooks/useCreateRequirement';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { UserSelector } from '@/features/subscriptions/components/UserSelector';
import { useProjectUsers } from '@/features/subscriptions/hooks/useProjectUsers';
import { attachmentsApi } from '@/features/attachments/services/attachmentsApi';
import { RichTextEditor } from '@/shared/components/ui/RichTextEditor/RichTextEditor';
import type { ApiError } from '@/lib/axios';
import type { RequirementPriority } from '../../types/requirement.types';
import styles from './CreateRequirementModal.module.scss';
import {
  PRIORITY_OPTIONS,
  TYPE_OPTIONS,
  type CreateRequirementModalProps,
  type RequirementType,
} from './CreateRequirementModal.types';

/**
 * Validación de CONVENIENCIA, para fallar rápido sin ida y vuelta.
 *
 * NO es la fuente de verdad: el límite de tamaño y las listas de extensiones y MIME viven
 * en `system_settings` de `core` y son configurables en caliente. Por eso los mensajes no
 * nombran ningún número ni ninguna extensión. El rechazo autoritativo llega del servidor.
 */
const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface PendingAttachment {
  /** Id de `files`: el archivo existe solo, sin vínculo. NO es un id de `attachments`. */
  fileId: number;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError | null;
  if (!apiError) return '';

  switch (apiError.code) {
    case 'file_not_owned':
      return 'No podés adjuntar un archivo que subió otra persona';
    case 'file_not_available':
      return 'El archivo no está disponible';
    case 'file_too_large':
      return 'El archivo supera el tamaño máximo permitido';
    case 'file_type_not_allowed':
      return 'Ese tipo de archivo no está permitido';
  }

  if (apiError.status === 403 || apiError.code === 'access_denied') {
    return 'Sin permiso para crear el requisito';
  }
  return apiError.message || 'Error al crear el requisito';
}

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

interface DropdownCoords {
  top: number;
  left: number;
  width: number;
}

export function CreateRequirementModal({ isOpen, onClose }: CreateRequirementModalProps) {
  const { activeProject } = useActiveProject();
  const { mutate, isPending, isError, error } = useCreateRequirement();
  const { data: projects } = useProjects();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number>(activeProject?.id ?? 0);
  const [priority, setPriority] = useState<RequirementPriority>('sin_prioridad');
  const [selectedType, setSelectedType] = useState<RequirementType | null>(null);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const { data: projectUsers } = useProjectUsers(selectedProjectId);
  const [titleError, setTitleError] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<DropdownCoords | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const descFileInputRef = useRef<HTMLInputElement>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement>(null);
  const typeTriggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const triggerRefs: Record<string, React.RefObject<HTMLButtonElement | null>> = {
    project: projectTriggerRef,
    priority: priorityTriggerRef,
    type: typeTriggerRef,
  };

  // Sync selected project when activeProject changes
  useEffect(() => {
    if (activeProject?.id) {
      setSelectedProjectId(activeProject.id);
    }
  }, [activeProject?.id]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setSelectedProjectId(activeProject?.id ?? 0);
    setPriority('sin_prioridad');
    setSelectedType(null);
    setSelectedSubscriberIds([]);
    setTitleError(false);
    setOpenDropdown(null);
    setDropdownCoords(null);
    setShowSuccess(false);
    setPendingAttachments([]);
    setAttachError('');
    setUploading(false);
    setUploadingFileName('');
    setUploadProgress(0);
  }

  function handleDescriptionChange(newValue: string) {
    setDescription(newValue);
    setPendingAttachments((prev) =>
      prev.filter((att) => newValue.includes(`attach:${att.fileId}`))
    );
  }

  async function handleDescFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (descFileInputRef.current) descFileInputRef.current.value = '';
    if (!file) return;
    // Se sube de a uno: mientras hay una subida en curso el botón está deshabilitado.
    if (uploading) return;
    setAttachError('');

    // Validación de conveniencia — ver la nota de ALLOWED_EXTENSIONS. Los mensajes son
    // los MISMOS que los del servidor, así que el usuario no distingue el origen.
    if (file.size > MAX_SIZE_BYTES) {
      setAttachError('El archivo supera el tamaño máximo permitido');
      return;
    }
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setAttachError('Ese tipo de archivo no está permitido');
      return;
    }

    try {
      setUploading(true);
      setUploadingFileName(file.name);
      setUploadProgress(0);
      // El archivo existe por sí solo: no se sube contra ninguna entidad y el vínculo se
      // crea recién al publicar el requisito. Si el usuario abandona el modal, el archivo
      // queda sin vínculo, que es un estado válido — no hay nada que limpiar.
      const uploaded = await attachmentsApi.uploadFile(file, setUploadProgress);
      const isImage = uploaded.mimeType.startsWith('image/');
      const placeholder = isImage ? `![attach:${uploaded.fileId}]` : `[attach:${uploaded.fileId}]`;

      setDescription((prev) => prev + placeholder);
      setPendingAttachments((prev) => [
        ...prev,
        {
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
        },
      ]);
    } catch (error) {
      setAttachError(getErrorMessage(error) || 'Error al subir el archivo');
    } finally {
      // Los tres caminos limpian el estado de subida, o el editor queda con una barra
      // congelada para siempre.
      setUploading(false);
      setUploadingFileName('');
      setUploadProgress(0);
    }
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // Close dropdowns on outside click or scroll
  useEffect(() => {
    if (!openDropdown) return;
    function handleMouseDown(e: MouseEvent) {
      const trigger = triggerRefs[openDropdown!]?.current;
      if (trigger && trigger.contains(e.target as Node)) return;
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setOpenDropdown(null);
      setDropdownCoords(null);
    }
    function handleScroll(e: Event) {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setOpenDropdown(null);
      setDropdownCoords(null);
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDropdown]);

  // Escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleSubmit() {
    if (!title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }

    mutate(
      {
        title: title.trim(),
        description,
        type: (selectedType ?? 'Otro').toLowerCase(),
        priority,
        projectId: selectedProjectId,
        subscriberUserIds: selectedSubscriberIds,
        fileIds: pendingAttachments.map((a) => a.fileId),
      },
      {
        onSuccess: () => {
          setShowSuccess(true);
          setTimeout(() => {
            handleClose();
          }, 1800);
        },
      }
    );
  }

  function toggleDropdown(id: string) {
    if (openDropdown === id) {
      setOpenDropdown(null);
      setDropdownCoords(null);
      return;
    }
    const triggerEl = triggerRefs[id]?.current;
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      setDropdownCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpenDropdown(id);
  }

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const selectedPriority =
    PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[0];
  const selectedTypeOption = TYPE_OPTIONS.find((t) => t.value === selectedType);

  // El error de creación se muestra pegado al formulario, no en un toast: el modal está
  // encima de todo y una notificación de 4 s detrás del overlay es peor que nada.
  const displayError = attachError || (isError ? getErrorMessage(error) : '');

  const panelStyle: React.CSSProperties | undefined = dropdownCoords
    ? { top: dropdownCoords.top, left: dropdownCoords.left, width: dropdownCoords.width }
    : undefined;

  const modal = (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {showSuccess ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="#22c55e" fillOpacity="0.12" />
                <path
                  d="M10 16.5l4.5 4.5 7.5-8"
                  stroke="#22c55e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.successTitle}>Elemento creado</p>
            <p className={styles.successSub}>El elemento fue agregado a análisis correctamente.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={styles.header}>
              <span className={styles.headerTitle}>Nuevo requisito</span>
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleClose}
                aria-label="Cerrar"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M1 1l11 11M12 1L1 12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Context bar — chip Análisis no editable */}
            <div className={styles.contextBar}>
              <button type="button" className={styles.statusChip} tabIndex={-1}>
                <span className={styles.statusDot} />
                Análisis
              </button>
            </div>

            {/* Body */}
            <div className={styles.body}>
              <input
                ref={titleRef}
                type="text"
                className={`${styles.titleInput} ${titleError ? styles.hasError : ''}`}
                placeholder="Título del requisito"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError && e.target.value.trim()) setTitleError(false);
                }}
                aria-label="Título del requisito"
                autoFocus
              />
              <div className={styles.descriptionWrapper}>
                <div className={styles.descScrollArea}>
                  <RichTextEditor
                    value={description}
                    onChange={handleDescriptionChange}
                    attachmentMeta={pendingAttachments.map((a) => ({
                      id: a.fileId,
                      fileName: a.fileName,
                      mimeType: a.mimeType,
                      fileSize: a.fileSize,
                    }))}
                    placeholder="Agregar descripción..."
                    uploading={uploading}
                    uploadingFileName={uploadingFileName}
                    uploadProgress={uploadProgress}
                  />
                </div>
                <div className={styles.descToolbar}>
                  <input
                    ref={descFileInputRef}
                    type="file"
                    data-testid="desc-file-input"
                    accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                    className={styles.fileInput}
                    onChange={handleDescFileChange}
                    aria-label="Adjuntar archivo a descripción"
                  />
                  <button
                    type="button"
                    className={styles.descAttachBtn}
                    onClick={() => descFileInputRef.current?.click()}
                    aria-label="Adjuntar archivo a descripción"
                    disabled={uploading}
                  >
                    <Paperclip size={14} aria-hidden="true" />
                    Adjuntar
                  </button>
                </div>
              </div>
              {displayError && (
                <p className={styles.attachError} role="alert">
                  {displayError}
                </p>
              )}
            </div>

            {/* Separator */}
            <div className={styles.separator} />

            {/* Fields section */}
            <div className={styles.fieldsSection}>
              <div className={styles.fieldsHeader}>Campos</div>
              <table className={styles.fieldsTable} role="presentation">
                <tbody>
                  {/* Proyecto */}
                  <tr className={styles.fieldRow}>
                    <td className={styles.fieldLabelCell}>
                      <div className={styles.fieldLabelInner}>Proyecto</div>
                    </td>
                    <td className={styles.fieldValueCell}>
                      <div className={styles.dropdownWrap}>
                        <button
                          ref={projectTriggerRef}
                          type="button"
                          className={styles.dropdownTrigger}
                          data-dropdown="project"
                          data-testid="dropdown-project"
                          onClick={() => toggleDropdown('project')}
                        >
                          <span>{selectedProject?.name ?? 'Sin proyecto'}</span>
                          <svg
                            className={styles.dropdownChevron}
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M2 3.5l3 3 3-3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Prioridad */}
                  <tr className={styles.fieldRow}>
                    <td className={styles.fieldLabelCell}>
                      <div className={styles.fieldLabelInner}>Prioridad</div>
                    </td>
                    <td className={styles.fieldValueCell}>
                      <div className={styles.dropdownWrap}>
                        <button
                          ref={priorityTriggerRef}
                          type="button"
                          className={styles.dropdownTrigger}
                          data-testid="dropdown-priority"
                          onClick={() => toggleDropdown('priority')}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="none"
                            className={styles[selectedPriority.dotClass]}
                            style={{ flexShrink: 0 }}
                          >
                            <path d="M5 3a1 1 0 0 0-1 1v17a1 1 0 0 0 2 0v-6h11.382a1 1 0 0 0 .894-1.447L16.118 10l2.158-3.553A1 1 0 0 0 17.382 5H6V4a1 1 0 0 0-1-1z" />
                          </svg>
                          <span>{selectedPriority.label}</span>
                          <svg
                            className={styles.dropdownChevron}
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M2 3.5l3 3 3-3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Tipo */}
                  <tr className={styles.fieldRow}>
                    <td className={styles.fieldLabelCell}>
                      <div className={styles.fieldLabelInner}>Tipo</div>
                    </td>
                    <td className={styles.fieldValueCell}>
                      <div className={styles.dropdownWrap}>
                        <button
                          ref={typeTriggerRef}
                          type="button"
                          className={styles.dropdownTrigger}
                          data-testid="dropdown-type"
                          onClick={() => toggleDropdown('type')}
                        >
                          {selectedTypeOption ? (
                            <>
                              <span>{selectedTypeOption.label}</span>
                            </>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Sin tipo</span>
                          )}
                          <svg
                            className={styles.dropdownChevron}
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M2 3.5l3 3 3-3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Suscriptores */}
            <div className={styles.fieldsSection}>
              <div className={styles.fieldsHeader}>Suscriptores</div>
              <table className={styles.fieldsTable} role="presentation">
                <tbody>
                  <tr className={styles.fieldRowNoBorder}>
                    <td className={styles.fieldLabelCell}>
                      {selectedSubscriberIds.length === 0 ? (
                        <span className={styles.subscribersEmpty}>Sin suscriptores</span>
                      ) : (
                        <div className={styles.pillsList}>
                          {selectedSubscriberIds.map((userId) => {
                            const user = projectUsers?.find((u) => u.id === userId);
                            return (
                              <span key={userId} className={styles.pill}>
                                {user?.name ?? userId}
                                <button
                                  type="button"
                                  className={styles.pillRemove}
                                  onClick={() =>
                                    setSelectedSubscriberIds((ids) =>
                                      ids.filter((id) => id !== userId)
                                    )
                                  }
                                  aria-label={`Quitar ${user?.name ?? userId}`}
                                >
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path
                                      d="M1 1l6 6M7 1L1 7"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className={styles.fieldValueCell}>
                      <div className={styles.dropdownWrap}>
                        <UserSelector
                          projectId={selectedProjectId}
                          selectedUserIds={selectedSubscriberIds}
                          onChange={setSelectedSubscriberIds}
                          triggerClassName={styles.dropdownTrigger}
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.createButton}
                onClick={handleSubmit}
                // Publicar mientras el byte viaja vincularía un archivo incompleto, y el
                // sistema no verifica que haya llegado.
                disabled={isPending || uploading}
              >
                {isPending ? 'Creando...' : 'Crear elemento'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Dropdown panels — rendered inside overlay portal to escape modal overflow */}
      {openDropdown === 'project' && panelStyle && (
        <div ref={panelRef} className={styles.dropdownPanel} style={panelStyle}>
          {projects?.map((project) => (
            <div
              key={project.id}
              className={`${styles.dropdownOption} ${project.id === selectedProjectId ? styles.selected : ''}`}
              onClick={() => {
                setSelectedProjectId(project.id);
                setOpenDropdown(null);
                setDropdownCoords(null);
              }}
            >
              {project.name}
            </div>
          ))}
        </div>
      )}

      {openDropdown === 'priority' && panelStyle && (
        <div ref={panelRef} className={styles.dropdownPanel} style={panelStyle}>
          {PRIORITY_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.dropdownOption} ${opt.value === priority ? styles.selected : ''}`}
              onClick={() => {
                setPriority(opt.value);
                setOpenDropdown(null);
                setDropdownCoords(null);
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
                className={styles[opt.dotClass]}
                style={{ flexShrink: 0 }}
              >
                <path d="M5 3a1 1 0 0 0-1 1v17a1 1 0 0 0 2 0v-6h11.382a1 1 0 0 0 .894-1.447L16.118 10l2.158-3.553A1 1 0 0 0 17.382 5H6V4a1 1 0 0 0-1-1z" />
              </svg>
              {opt.label}
            </div>
          ))}
        </div>
      )}

      {openDropdown === 'type' && panelStyle && (
        <div ref={panelRef} className={styles.dropdownPanel} style={panelStyle}>
          {TYPE_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.dropdownOption} ${opt.value === selectedType ? styles.selected : ''}`}
              onClick={() => {
                setSelectedType(opt.value);
                setOpenDropdown(null);
                setDropdownCoords(null);
              }}
            >
              <span>{opt.label}</span>
              <span className={styles.typeDescription}>({opt.description})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
