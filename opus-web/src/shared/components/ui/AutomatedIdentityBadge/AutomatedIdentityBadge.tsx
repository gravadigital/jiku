import { Badge } from '../Badge';
import type { IdentityType } from '@/shared/types';

interface AutomatedIdentityBadgeProps {
  readonly identityType?: IdentityType;
  /** Clase del punto de insercion, para el ajuste de layout de esa fila (p. ej. `flex-shrink: 0`). */
  readonly className?: string;
}

/**
 * Marca de identidad automatica (`marca-identidad-automatica`, REQ-005 / S-019).
 *
 * Acompaña al nombre del autor cuando NO es una persona: dice que CLASE de autor es, sin
 * reemplazar el `name` (CA-11). Se renderiza SOLO si `identityType === 'service'`; para una
 * persona no hay bloque ni espacio reservado, y un valor ausente o inesperado tampoco marca
 * — falla del lado seguro: se pierde una marca, nunca se marca a una persona (CA-10).
 *
 * El texto visible y el nombre accesible estan aprobados por la Revision UX de REQ-005: no
 * se cambian sin volver a pasar por revision UX (CA-9).
 *
 * Compone `Badge` con la variant neutra: no escribe estilos propios. La marca no es exito,
 * ni error, ni advertencia, ni una accion — es una clasificacion del autor, y va neutra.
 *
 * Lleva `role="img"` para que el `aria-label` sea el nombre accesible de verdad: sobre un
 * `span` sin rol (`generic`) los lectores de pantalla ignoran el `aria-label` y leen el
 * texto, y el badge se anunciaria como "Automatico" suelto — justo lo que la guideline de
 * accesibilidad de la superficie descarta. No es un rol de control: no es enfocable ni
 * operable (CA-14).
 */
export function AutomatedIdentityBadge({ identityType, className }: AutomatedIdentityBadgeProps) {
  if (identityType !== 'service') return null;

  return (
    <Badge
      variant="default"
      className={className}
      role="img"
      aria-label="Identidad automática: no es una persona"
    >
      Automático
    </Badge>
  );
}
