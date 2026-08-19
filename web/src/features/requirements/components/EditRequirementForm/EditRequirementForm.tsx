'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useAttachments } from '@/features/attachments/hooks/useAttachments';
import {
  extractAttachmentIds,
  extractFileIds,
} from '@/features/attachments/utils/extractFileIds';
import { fileErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { usePersons } from '@/features/auth';
import { transformYupErrors } from '@/shared/utils/transform-yup-errors';
import { useRequirementTagSuggestions } from '../../hooks/useRequirementTagSuggestions';
import { useUpdateRequirement } from '../../hooks/useUpdateRequirement';
import {
  RequirementRichTextEditor,
  type RequirementRichTextEditorHandle,
} from '../RequirementRichTextEditor';
import styles from './EditRequirementForm.module.scss';
import type {
  Requirement,
  RequirementPriority,
  RequirementState,
  RequirementTag,
  RequirementType,
  UpdateRequirementPayload,
  VisibilityLevel,
} from '../../types/requirement.types';

const TYPE_OPTIONS = [
  { label: 'Sin tipo', value: '' },
  { label: 'Funcionalidad', value: 'funcionalidad' },
  { label: 'Mejora', value: 'mejora' },
  { label: 'Incidencia', value: 'incidencia' },
  { label: 'Otro', value: 'otro' },
];

const PRIORITY_OPTIONS = [
  { label: 'Sin prioridad', value: 'sin_prioridad' },
  { label: 'Baja', value: 'baja' },
  { label: 'Media', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Urgente', value: 'urgente' },
];

const STATE_OPTIONS = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Resuelto', value: 'resuelto' },
  { label: 'Cancelado', value: 'cancelado' },
];

const VISIBILITY_OPTIONS = [
  { label: 'Público', value: 'public' },
  { label: 'Interno', value: 'internal' },
];

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    height: '40px',
    minHeight: '40px',
    border: state.isFocused ? '1px solid var(--color-highlighted)' : '1px solid #e6e8ed',
    borderRadius: '8px',
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.875rem',
    fontWeight: 400,
    backgroundColor: '#fff',
    cursor: 'pointer',
    '&:hover': {
      border: state.isFocused ? '1px solid var(--color-highlighted)' : '1px solid #e6e8ed',
    },
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    padding: '0 0.75rem',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap' as const,
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  indicatorsContainer: (base: Record<string, unknown>) => ({
    ...base,
    height: '40px',
    display: 'flex',
    alignItems: 'center',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    zIndex: 10,
    fontSize: '0.875rem',
    borderRadius: '8px',
    border: '1px solid #e6e8ed',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  }),
  option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    backgroundColor: state.isSelected ? '#DA2C6A' : state.isFocused ? '#E2E8F0' : '#fff',
    color: state.isSelected ? '#fff' : '#1F2633',
    cursor: 'pointer',
  }),
  singleValue: (base: Record<string, unknown>) => ({ ...base, color: '#1F2633' }),
  placeholder: (base: Record<string, unknown>) => ({ ...base, color: '#aaa' }),
};

// Estilos calcados de InputMultiplePersons (usado en creación/edición de tarea) para que el
// multi-select de Responsables se comporte igual: chips que no se achican, wrap sin altura fija.
const responsibleSelectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    '&:hover': { cursor: 'pointer' },
    backgroundColor: '#fff',
    border: '0.5px solid var(--color-general-border)',
    borderRadius: 'var(--radius-items)',
    boxSizing: 'border-box' as const,
    color: 'var(--color-general-title)',
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: '1.5rem',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    width: '100%',
  }),
  multiValue: (base: Record<string, unknown>, state: { index: number }) => ({
    ...base,
    alignItems: 'center',
    backgroundColor: state.index === 0 ? '#D9D9D9' : '#f5f2f0',
    borderRadius: 'var(--radius-items)',
    color: '#666',
    display: 'flex',
    fontFamily: 'var(--font-primary)',
    fontSize: '1rem',
    margin: '5px',
    padding: '2px 6px',
  }),
  multiValueLabel: (base: Record<string, unknown>, state: { index: number }) => ({
    ...base,
    color: state.index === 0 ? '#000' : 'var(--color-general-title)',
  }),
  multiValueRemove: (base: Record<string, unknown>) => ({
    cursor: 'pointer',
    ...base,
    '&:hover': { color: 'darkred' },
    background: 'none',
    border: 'none',
    color: 'red',
    fontSize: '1rem',
    marginLeft: '5px',
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    fontSize: '0.875rem',
    color: '#aaa',
  }),
};

const schema = Yup.object({
  title: Yup.string()
    .required('El título es requerido')
    .test('not-blank', 'El título es requerido', (v) => !!v && v.trim().length > 0),
});

interface FormState {
  title: string;
  description: string;
  type: string;
  priority: string;
  state: string;
  visibilityLevel: string;
  estimatedFinishDate: string;
  responsiblePersonIds: string[];
}

interface EditRequirementFormProps {
  readonly requirement: Requirement;
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sortByLeaderFirst(
  people: Requirement['responsiblePeople']
): Requirement['responsiblePeople'] {
  const leader = people.find((person) => person.isLeader);
  if (!leader) return people;
  return [leader, ...people.filter((person) => person !== leader)];
}

export function EditRequirementForm({ requirement }: EditRequirementFormProps) {
  const router = useRouter();
  const { mutate: updateRequirement, isPending } = useUpdateRequirement();
  const { data: persons = [] } = usePersons();
  const { data: linkedAttachments = [] } = useAttachments('requirement', requirement.id);
  const editorRef = useRef<RequirementRichTextEditorHandle>(null);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Traduce el texto del editor al conjunto completo de `fileIds`:
   * los `[attach:N]` ya vinculados se resuelven a su `fileId`, y los
   * `[file:N]` recién subidos ya son `fileId`.
   */
  function buildFileIds(description: string): number[] {
    const fileIdByAttachmentId = new Map(linkedAttachments.map((a) => [a.id, a.fileId]));
    const linked = extractAttachmentIds(description)
      .map((attachmentId) => fileIdByAttachmentId.get(attachmentId))
      .filter((fileId): fileId is number => fileId !== undefined);
    return [...new Set([...linked, ...extractFileIds(description)])];
  }
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const right = panelRightRef.current;
    const left = panelLeftRef.current;
    if (!right || !left) return;
    const observer = new ResizeObserver(() => {
      left.style.maxHeight = right.offsetHeight + 'px';
    });
    observer.observe(right);
    return () => observer.disconnect();
  }, []);

  const [form, setForm] = useState<FormState>({
    title: requirement.title,
    description: requirement.description,
    type: requirement.type ?? '',
    priority: requirement.priority,
    state: requirement.state,
    visibilityLevel: requirement.visibilityLevel,
    estimatedFinishDate: requirement.estimatedFinishDate?.slice(0, 10) ?? '',
    responsiblePersonIds: sortByLeaderFirst(requirement.responsiblePeople ?? []).map((person) =>
      String(person.id)
    ),
  });
  const [, setErrors] = useState<Record<string, string>>({});
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [tags, setTags] = useState<RequirementTag[]>(requirement.tags ?? []);
  const [uploadError, setUploadError] = useState('');

  const { data: tagSuggestions = [] } = useRequirementTagSuggestions(requirement.projectId);

  const responsibleOptions = persons
    .filter((p) => p.id != null)
    .map((p) => ({
      label: `${p.firstName} ${p.lastName}`,
      value: String(p.id),
    }));

  // Para incidencias, "En cola" no se ofrece como opción — salvo que el requisito ya
  // esté en ese estado (dato heredado), en cuyo caso value se resuelve contra la lista
  // completa (STATE_OPTIONS) y sigue mostrándose sin forzarse ni limpiarse.
  const stateOptions =
    form.type === 'incidencia' ? STATE_OPTIONS.filter((o) => o.value !== 'en_cola') : STATE_OPTIONS;

  function handleAddTag() {
    if (!tagKey.trim() || !tagValue.trim()) return;
    setTags((prev) => [...prev, { key: tagKey.trim(), value: tagValue.trim() }]);
    setTagKey('');
    setTagValue('');
  }

  function handleRemoveTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSuggestionClick(key: string, value: string) {
    setTagKey(key);
    setTagValue(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    try {
      await schema.validate({ title: form.title }, { abortEarly: false });
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        setErrors(transformYupErrors(err));
        return;
      }
    }

    // `fileIds` conserva la semántica de conjunto COMPLETO que tenía
    // `attachmentIds`: son todos los archivos que deben quedar vinculados al
    // requisito tras este guardado, y el backend deduce qué vincular y qué
    // desvincular. Por eso hay que incluir también los ya vinculados, que en el
    // texto aparecen como `[attach:N]` con id de VÍNCULO: se traducen a su
    // `fileId` con la lista de adjuntos del requisito. Omitirlos desvincularía
    // en silencio todo lo que ya estaba.
    const payload: UpdateRequirementPayload = {
      title: form.title,
      description: form.description,
      type: (form.type === '' ? null : form.type) as RequirementType,
      priority: form.priority as RequirementPriority,
      state: form.state as RequirementState,
      visibilityLevel: form.visibilityLevel as VisibilityLevel,
      tags,
      responsiblePersonIds: form.responsiblePersonIds.map(Number),
      ...(form.estimatedFinishDate && { estimatedFinishDate: form.estimatedFinishDate }),
      fileIds: buildFileIds(form.description),
    };

    updateRequirement(
      { reqid: requirement.id, payload },
      {
        onSuccess: () => {
          toast.success('Requisito actualizado correctamente');
          router.push(`/requirements/${requirement.id}`);
        },
        onError: (error: unknown) => {
          toast.error(fileErrorMessage(error, 'Hubo un error al actualizar el requisito'));
        },
      }
    );
  }

  const tagIcon = (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l7.29-7.29a1 1 0 0 0 0-1.42L12 2z" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Editar Requisito</h1>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/requirements/${requirement.id}`} className={styles.backButton}>
            Volver
          </Link>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isPending || isUploading}
            aria-busy={isPending}
            aria-describedby={isUploading ? 'edit-upload-in-progress' : undefined}
          >
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
          {isUploading && (
            <span id="edit-upload-in-progress" className={styles.srOnly}>
              Hay una subida en curso: esperá a que el archivo termine de subir para guardar
            </span>
          )}
        </div>
      </header>

      <div className={styles.panels}>
        {/* Panel izquierdo */}
        <div className={styles.panelLeft} ref={panelLeftRef}>
          <div className={styles.panelCard}>
            <h2 className={styles.panelTitle}>Detalle</h2>

            <div className={styles.field}>
              <label htmlFor="edit-title" className={styles.fieldLabel}>
                Título{' '}
                {!form.title.trim() && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <input
                id="edit-title"
                type="text"
                className={styles.fieldInput}
                aria-label="Título"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label id="edit-description-label" className={styles.fieldLabel}>
                Contexto{' '}
                {!form.description.trim() && <span className={styles.required}>(obligatorio)</span>}
              </label>
              {uploadError && <span className={styles.fieldError}>{uploadError}</span>}
              <RequirementRichTextEditor
                ref={editorRef}
                initialValue={form.description}
                ariaLabel="Contexto"
                placeholder="Describe el requisito..."
                onChange={(value) => setForm((f) => ({ ...f, description: value }))}
                onUploadError={setUploadError}
                onUploadingChange={setIsUploading}
              />
            </div>
          </div>

          {/* Etiquetas */}
          <div className={styles.tagsSection}>
            <label className={styles.tagsLabel}>Etiquetas</label>

            {tagSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {tagSuggestions.flatMap((s) =>
                  s.values.map((v) => (
                    <button
                      key={`${s.key}:${v}`}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => handleSuggestionClick(s.key, v)}
                    >
                      {tagIcon}
                      {s.key}: {v}
                    </button>
                  ))
                )}
              </div>
            )}

            <div className={styles.tagList}>
              {tags.map((tag, i) => (
                <span key={i} className={styles.chip}>
                  {tagIcon}
                  {tag.key}: {tag.value}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => handleRemoveTag(i)}
                    aria-label={`Eliminar tag ${tag.key}:${tag.value}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className={styles.tagInputRow}>
              <div className={styles.tagField}>
                <label htmlFor="edit-tagKey" className={styles.tagFieldLabel}>
                  Clave
                </label>
                <input
                  id="edit-tagKey"
                  type="text"
                  className={styles.tagInput}
                  aria-label="Clave"
                  value={tagKey}
                  onChange={(e) => setTagKey(e.target.value)}
                />
              </div>
              <div className={styles.tagField}>
                <label htmlFor="edit-tagValue" className={styles.tagFieldLabel}>
                  Valor
                </label>
                <input
                  id="edit-tagValue"
                  type="text"
                  className={styles.tagInput}
                  aria-label="Valor"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.addTagButton}
                onClick={handleAddTag}
                disabled={!tagKey.trim() || !tagValue.trim()}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        {/* Panel derecho — Información general */}
        <aside className={styles.panelRight} ref={panelRightRef}>
          <h2 className={styles.panelTitle}>Información general</h2>

          {/* Proyecto — read-only */}
          <div className={styles.field}>
            <label htmlFor="edit-project" className={styles.fieldLabel}>
              Proyecto
            </label>
            <input
              id="edit-project"
              type="text"
              className={styles.fieldInput}
              aria-label="Proyecto"
              value={requirement.project?.name ?? String(requirement.projectId)}
              disabled
              readOnly
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-state" className={styles.fieldLabel}>
              Estado
            </label>
            <Select
              inputId="edit-state"
              aria-label="Estado"
              styles={selectStyles}
              options={stateOptions}
              value={STATE_OPTIONS.find((o) => o.value === form.state) ?? STATE_OPTIONS[0]}
              onChange={(opt) => setForm((f) => ({ ...f, state: opt?.value ?? 'analisis' }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-type" className={styles.fieldLabel}>
              Tipo
            </label>
            <Select
              inputId="edit-type"
              aria-label="Tipo"
              styles={selectStyles}
              options={TYPE_OPTIONS}
              value={TYPE_OPTIONS.find((o) => o.value === form.type) ?? TYPE_OPTIONS[0]}
              onChange={(opt) => setForm((f) => ({ ...f, type: opt?.value ?? '' }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-priority" className={styles.fieldLabel}>
              Prioridad
            </label>
            <Select
              inputId="edit-priority"
              aria-label="Prioridad"
              styles={selectStyles}
              options={PRIORITY_OPTIONS}
              value={PRIORITY_OPTIONS.find((o) => o.value === form.priority) ?? PRIORITY_OPTIONS[0]}
              onChange={(opt) =>
                setForm((f) => ({ ...f, priority: opt?.value ?? 'sin_prioridad' }))
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-visibility" className={styles.fieldLabel}>
              Visibilidad
            </label>
            <Select
              inputId="edit-visibility"
              aria-label="Visibilidad"
              styles={selectStyles}
              options={VISIBILITY_OPTIONS}
              value={
                VISIBILITY_OPTIONS.find((o) => o.value === form.visibilityLevel) ??
                VISIBILITY_OPTIONS[0]
              }
              onChange={(opt) =>
                setForm((f) => ({ ...f, visibilityLevel: opt?.value ?? 'public' }))
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-responsible" className={styles.fieldLabel}>
              Responsable(s)
            </label>
            <Select
              inputId="edit-responsible"
              aria-label="Responsable(s)"
              isMulti
              isClearable={false}
              placeholder="Seleccionar responsable(s)..."
              styles={responsibleSelectStyles}
              options={responsibleOptions}
              value={form.responsiblePersonIds
                .map((id) => responsibleOptions.find((o) => o.value === id))
                .filter((o): o is { label: string; value: string } => !!o)}
              onChange={(opts) =>
                setForm((f) => ({
                  ...f,
                  responsiblePersonIds: (opts ?? []).map((opt) => opt.value),
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-createdAt" className={styles.fieldLabel}>
              Fecha de creación
            </label>
            <input
              id="edit-createdAt"
              type="text"
              className={styles.fieldInput}
              aria-label="Fecha de creación"
              value={formatDate(requirement.createdAt)}
              disabled
              readOnly
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-estimatedFinishDate" className={styles.fieldLabel}>
              Fecha de finalización estimada
            </label>
            <input
              id="edit-estimatedFinishDate"
              type="date"
              className={styles.fieldInput}
              aria-label="Fecha estimada"
              value={form.estimatedFinishDate}
              onChange={(e) => setForm((f) => ({ ...f, estimatedFinishDate: e.target.value }))}
            />
          </div>
        </aside>
      </div>
    </form>
  );
}
