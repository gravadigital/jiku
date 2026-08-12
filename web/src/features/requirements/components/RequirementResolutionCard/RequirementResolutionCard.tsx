'use client';

import React, { useEffect, useState } from 'react';
import { RESOLUTION_TYPE_OPTIONS } from '../../utils/resolutionHelpers';
import styles from './RequirementResolutionCard.module.scss';
import type { Requirement, UpdateRequirementPayload } from '../../types/requirement.types';

interface RequirementResolutionCardProps {
  readonly requirement: Requirement;
  readonly onUpdate: (payload: UpdateRequirementPayload) => void;
  readonly isPending?: boolean;
}

type ResolutionDrafts = {
  resolutionType: string;
  resolutionConclusion: string;
  resolutionComment: string;
};

function draftsFromRequirement(requirement: Requirement): ResolutionDrafts {
  return {
    resolutionType: requirement.resolutionType ?? '',
    resolutionConclusion: requirement.resolutionConclusion ?? '',
    resolutionComment: requirement.resolutionComment ?? '',
  };
}

const RESULT_LABELS: Record<'resuelto' | 'cancelado', string> = {
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// El requisito no tiene un campo directo de "fecha de resolución" — se deriva de la
// última transición de estado hacia "resuelto" registrada en el historial de actividad.
function getResolutionDate(requirement: Requirement): string | null {
  const stateChanges = (requirement.activity ?? []).filter(
    (entry) => entry.typeOfActivity === 'state' && entry.newValue === 'resuelto'
  );
  if (stateChanges.length === 0) return null;
  return stateChanges[stateChanges.length - 1].createdAt;
}

export function RequirementResolutionCard({
  requirement,
  onUpdate,
  isPending,
}: RequirementResolutionCardProps) {
  const { state } = requirement;
  const isResolved = state === 'resuelto';
  const isCancelled = state === 'cancelado';
  const isClosed = isResolved || isCancelled;
  const showResolutionFields = requirement.type === 'incidencia';

  const [drafts, setDrafts] = useState<ResolutionDrafts>(() => draftsFromRequirement(requirement));

  useEffect(() => {
    setDrafts(draftsFromRequirement(requirement));
  }, [requirement]);

  const handleDraftChange = (field: keyof ResolutionDrafts, value: string) => {
    setDrafts((prev) => ({ ...prev, [field]: value }));
  };

  const saveChangedFields = () => {
    const current = draftsFromRequirement(requirement);
    (Object.keys(drafts) as (keyof ResolutionDrafts)[]).forEach((field) => {
      if (drafts[field] !== current[field]) {
        onUpdate({ [field]: drafts[field] } as UpdateRequirementPayload);
      }
    });
  };

  const handleResolve = () => {
    if (showResolutionFields) saveChangedFields();
    onUpdate({ state: 'resuelto' });
  };

  const handleCancel = () => {
    onUpdate({ state: 'cancelado' });
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Resolución</div>

      {requirement.estimatedFinishDate && (
        <dl className={styles.row}>
          <dt>Cierre estimado</dt>
          <dd>{formatDate(requirement.estimatedFinishDate)}</dd>
        </dl>
      )}

      {showResolutionFields && (
        <div className={styles.resolutionFields}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="resolution-type">
              Tipo de resolución
            </label>
            <select
              id="resolution-type"
              className={styles.inlineFormInput}
              value={drafts.resolutionType}
              onChange={(e) => handleDraftChange('resolutionType', e.target.value)}
              disabled={isPending || isClosed}
            >
              <option value="">Seleccioná una opción</option>
              {RESOLUTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="resolution-conclusion">
              Conclusión interna
            </label>
            <textarea
              id="resolution-conclusion"
              className={styles.inlineFormTextarea}
              placeholder="Describí la conclusión interna de esta incidencia..."
              value={drafts.resolutionConclusion}
              onChange={(e) => handleDraftChange('resolutionConclusion', e.target.value)}
              disabled={isPending || isClosed}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="resolution-comment">
              Nota para cliente
            </label>
            <textarea
              id="resolution-comment"
              className={styles.inlineFormTextarea}
              placeholder="Describí la resolución de esta incidencia..."
              value={drafts.resolutionComment}
              onChange={(e) => handleDraftChange('resolutionComment', e.target.value)}
              disabled={isPending || isClosed}
            />
          </div>
        </div>
      )}

      {isResolved ? (
        <dl className={`${styles.row} ${styles.rowLast}`}>
          <dt>Fecha de finalización</dt>
          <dd>{formatDate(getResolutionDate(requirement))}</dd>
        </dl>
      ) : isClosed ? (
        <div className={`${styles.resultBadge} ${styles.resultBadgeCancelled}`}>
          {RESULT_LABELS[state as 'resuelto' | 'cancelado']}
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.resolveButton}
            onClick={handleResolve}
            disabled={isPending}
          >
            Resolver
          </button>
        </div>
      )}
    </div>
  );
}
