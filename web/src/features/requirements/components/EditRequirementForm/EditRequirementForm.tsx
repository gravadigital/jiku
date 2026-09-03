'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useAttachments } from '@/features/attachments/hooks/useAttachments';
import {
  extractAttachmentIds,
  extractFileIds,
} from '@/features/attachments/utils/extractFileIds';
import { fileErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { usePersons } from '@/features/auth';
import { Badge, Button, Card, Input, Select } from '@/shared/components/ui';
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

  // `Button` renderiza `type="button"` fijo y no acepta prop `type`: no puede ser el submit
  // nativo de un `<form>`. La mecánica de submit se preserva disparando el mismo handler por
  // `onClick` que hoy corre en `onSubmit` — no se cambia el componente compartido.
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
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

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Editar Requisito</h1>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary-nav" href={`/requirements/${requirement.id}`}>
            Volver
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || isUploading}
            loading={isPending}
            ariaDescribedBy={isUploading ? 'edit-upload-in-progress' : undefined}
          >
            {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
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
          <Card variant="panel" title="Detalle" headingLevel="h2">
            <div className={styles.field}>
              <Input
                variant="text"
                label="Título"
                value={form.title}
                onChange={(value) => setForm((f) => ({ ...f, title: value }))}
                required
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
          </Card>

          {/* Etiquetas */}
          <Card variant="panel" title="Etiquetas" headingLevel="h2">
            {tagSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {tagSuggestions.flatMap((s) =>
                  s.values.map((v) => (
                    <Button
                      key={`${s.key}:${v}`}
                      variant="secondary-dismiss"
                      onClick={() => handleSuggestionClick(s.key, v)}
                    >
                      {s.key}: {v}
                    </Button>
                  ))
                )}
              </div>
            )}

            <div className={styles.tagList}>
              {tags.map((tag, i) => (
                <span key={i} className={styles.chip}>
                  <Badge variant="card-tag" label={`${tag.key}: ${tag.value}`} />
                  <Button variant="secondary-dismiss" onClick={() => handleRemoveTag(i)}>
                    <span aria-hidden="true">×</span>
                    <span className={styles.srOnly}>
                      Eliminar tag {tag.key}:{tag.value}
                    </span>
                  </Button>
                </span>
              ))}
            </div>

            <div className={styles.tagInputRow}>
              <Input variant="text" label="Clave" value={tagKey} onChange={setTagKey} />
              <Input variant="text" label="Valor" value={tagValue} onChange={setTagValue} />
              <Button
                variant="secondary-dismiss"
                onClick={handleAddTag}
                disabled={!tagKey.trim() || !tagValue.trim()}
              >
                Agregar
              </Button>
            </div>
          </Card>
        </div>

        {/* Panel derecho — Información general */}
        <aside className={styles.panelRight} ref={panelRightRef}>
          <Card variant="panel" title="Información general" headingLevel="h2">
            {/* Proyecto — read-only */}
            <div className={styles.field}>
              <Input
                variant="locked"
                label="Proyecto"
                value={requirement.project?.name ?? String(requirement.projectId)}
                onChange={() => {}}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Estado"
                options={STATE_OPTIONS}
                value={form.state}
                onChange={(value) => setForm((f) => ({ ...f, state: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Tipo"
                placeholder="Sin tipo"
                options={TYPE_OPTIONS}
                value={form.type}
                onChange={(value) => setForm((f) => ({ ...f, type: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Prioridad"
                options={PRIORITY_OPTIONS}
                value={form.priority}
                onChange={(value) => setForm((f) => ({ ...f, priority: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Visibilidad"
                options={VISIBILITY_OPTIONS}
                value={form.visibilityLevel}
                onChange={(value) => setForm((f) => ({ ...f, visibilityLevel: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="multiple"
                label="Responsable(s)"
                placeholder="Seleccionar responsable(s)..."
                options={responsibleOptions}
                value={form.responsiblePersonIds}
                onChange={(values) =>
                  setForm((f) => ({
                    ...f,
                    responsiblePersonIds: values,
                  }))
                }
              />
            </div>

            <div className={styles.field}>
              <Input
                variant="locked"
                label="Fecha de creación"
                value={formatDate(requirement.createdAt)}
                onChange={() => {}}
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
          </Card>
        </aside>
      </div>
    </form>
  );
}
