import React from 'react';
import styles from './AutomatedIdentityBadge.module.scss';
import type { IdentityType } from '@/shared/types';

interface AutomatedIdentityBadgeProps {
  readonly identityType?: IdentityType;
}

/**
 * Marca de identidad automática (`marca-identidad-automatica`, REQ-005 / S-019).
 *
 * Acompaña al nombre del autor cuando NO es una persona: dice qué CLASE de autor es, sin
 * reemplazar el `name`. Se renderiza SOLO si `identityType === 'service'`; para una persona
 * no hay bloque ni espacio reservado, y un valor ausente o inesperado tampoco marca — falla
 * del lado seguro: se pierde una marca, nunca se marca a una persona.
 *
 * El texto visible y el nombre accesible están aprobados por la Revisión UX de REQ-005: no
 * se cambian sin volver a pasar por revisión UX.
 *
 * No es interactivo (no habilita ninguna acción) y no lleva icono.
 *
 * Lleva `role="img"` para que el `aria-label` sea el nombre accesible de verdad: sobre un
 * `span` sin rol (`generic`) los lectores de pantalla ignoran el `aria-label` y leen el
 * texto, y el badge se anunciaria como "Automático" suelto — justo lo que la regla de
 * accesibilidad del bloque descarta. No es un rol de control: no es enfocable ni operable.
 */
export function AutomatedIdentityBadge({ identityType }: AutomatedIdentityBadgeProps) {
  if (identityType !== 'service') return null;

  return (
    <span className={styles.badge} role="img" aria-label="Identidad automática: no es una persona">
      Automático
    </span>
  );
}
