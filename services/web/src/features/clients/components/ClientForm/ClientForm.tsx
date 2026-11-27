'use client';

import React, { useState, useMemo } from 'react';
import { Button, Card, Input } from '@/shared/components/ui';
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
    <Card variant="panel">
      <div className={styles.formContainer}>
        <div className={styles.leftColumn}>
          <Input
            label="Nombre"
            value={name}
            onChange={setName}
            placeholder="Nombre del actor"
            required
          />

          <div className={styles.descriptionField}>
            <Input
              variant="textarea"
              label="Descripción"
              value={description}
              onChange={setDescription}
              placeholder="Descripción del actor (soporta **markdown**)"
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
    </Card>
  );
}
