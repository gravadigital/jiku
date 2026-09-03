'use client';

import React, { useState, useMemo } from 'react';
import { InputText, Button, SectionCard } from '@/shared/components/ui';
import { InputTextarea } from '@/shared/components/ui/InputTextarea/InputTextarea';
import styles from './ClientForm.module.scss';

interface ClientFormProps {
  readonly initialValues?: {
    name: string;
    description: string;
  };
  readonly onSubmit: (payload: { name: string; description: string }) => void;
  readonly submitLabel: string;
  readonly loading?: boolean;
  readonly clientId?: number;
}

export function ClientForm({
  initialValues,
  onSubmit,
  submitLabel,
  loading = false,
}: ClientFormProps) {
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [generalError, setGeneralError] = useState<string | null>(null);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initialValues?.name || '',
        description: initialValues?.description || '',
      }),
    [initialValues]
  );

  const currentSnapshot = JSON.stringify({ name, description });
  const hasChanges = currentSnapshot !== initialSnapshot;

  const processSubmit = () => {
    setGeneralError(null);

    if (!hasChanges) {
      setGeneralError('No hay cambios para guardar');
      return;
    }

    if (!name.trim()) {
      setGeneralError('El nombre es obligatorio');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <SectionCard>
      <div className={styles.formContainer}>
        <div className={styles.leftColumn}>
          <InputText
            label="Nombre"
            code="name"
            value={name}
            onChange={(value) => setName(value)}
            placeholder="Nombre del actor"
            required
          />

          <div className={styles.descriptionField}>
            <InputTextarea
              label="Descripción"
              code="description"
              value={description}
              onChange={(value: string) => setDescription(value)}
              placeholder="Descripción del actor (soporta **markdown**)"

              error={false}
            />
          </div>
        </div>

        <div className={styles.buttonRow}>
          {generalError && <p className={styles.errorText}>{generalError}</p>}
          <Button onClick={processSubmit} loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
