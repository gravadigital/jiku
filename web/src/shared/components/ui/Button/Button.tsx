'use client';
import React, { MouseEvent, MouseEventHandler } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils/cn';
import { Loader } from '../Loader';
import styles from './Button.module.scss';

/**
 * Criterio de clasificación de variants para migrar los usos existentes de `Button`
 * (S-056 a S-058) y los 104 `<button>` crudos detectados por el REQ-013. Esta story
 * (S-053) sólo construye el componente — no migra ningún uso — pero deja el criterio
 * escrito acá para que el implementador de esas stories lo encuentre.
 *
 * | Intención del uso                                   | Variant              | Señal para reconocerlo |
 * |------------------------------------------------------|----------------------|-------------------------|
 * | Acción principal de la vista, cambia estado del sistema | `primary`         | «Guardar», «Crear», «Agregar», «Nuevo …». Uno solo por vista. |
 * | Vuelve a la pantalla anterior o sube un nivel        | `secondary-nav`      | «Volver», «Atrás», «Cancelar» que navega en vez de descartar. Borde verde agua. |
 * | Descarta lo que se está haciendo sin salir           | `secondary-dismiss`  | «Cancelar» en formulario/modal, «Cerrar», y ambas acciones de un `ConfirmDialog` (incluida la destructiva). Borde claro. |
 * | Entra o sale de la sesión                            | `session`            | «Iniciar sesión», «Cerrar sesión». Sólo esos dos. |
 * | Avanza el estado de un flujo                         | `flow`               | «Pasar a revisión», «Marcar resuelto». Icono → a la derecha. |
 *
 * Riesgos a verificar durante la migración (registrados por el REQ, no resueltos acá):
 * - **`Button` dentro de un `<form>`:** el componente no tiene prop `type` y renderiza
 *   `type="button"`, así que no puede ser el submit nativo. Revisar cada uso dentro de
 *   un `<form>` antes de migrarlo.
 * - **14 usos con `size="small"`** quedan sin destino directo en la API nueva: se
 *   resuelven con badge o pill, uso por uso, en las stories de pantalla.
 * - **104 `<button>` crudos en 48 archivos** son el grueso del trabajo de migración.
 */

/**
 * Variants semánticos del spec `Button` v2.0.1. `secondary-nav` navega (borde verde
 * agua); `secondary-dismiss` descarta (borde claro). No son intercambiables.
 */
type ButtonVariant = 'primary' | 'secondary-nav' | 'secondary-dismiss' | 'session' | 'flow';

interface ButtonBaseProps {
  /** Slot del label. Omitible sólo en el FAB, que no lleva texto visible. */
  readonly children?: React.ReactNode;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: string;
  readonly iconTrailing?: boolean;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Extensión local, fuera del spec: navega al hacer click cuando no hay `onClick`.
   * Existe para no romper los usos actuales de "Volver" (`secondary-nav`) antes de que
   * S-056 los migre. El spec dice "NO SE DEBE usar el botón para navegar entre
   * pantallas" salvo este caso semántico ya resuelto.
   */
  readonly href?: string;
  /** Id del elemento que explica el estado del botón, para `aria-describedby`. */
  readonly ariaDescribedBy?: string;
}

interface ButtonFabProps extends ButtonBaseProps {
  readonly fab: true;
  /** Obligatorio en el FAB: no tiene texto visible. */
  readonly 'aria-label': string;
}

interface ButtonRegularProps extends ButtonBaseProps {
  readonly fab?: false;
}

export type ButtonProps = ButtonFabProps | ButtonRegularProps;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary,
  'secondary-nav': styles.secondaryNav,
  'secondary-dismiss': styles.secondaryDismiss,
  session: styles.session,
  flow: styles.flow,
};

export function Button(props: ButtonProps) {
  const { push } = useRouter();
  const {
    children,
    variant = 'primary',
    disabled = false,
    loading = false,
    icon,
    iconTrailing = false,
    onClick,
    href,
    ariaDescribedBy,
    fab = false,
  } = props;
  const ariaLabel = fab ? (props as ButtonFabProps)['aria-label'] : undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (onClick) {
      onClick(event);
      return;
    }
    if (href) {
      push(href);
    }
  };

  const content = loading ? (
    <Loader variant="inline" size="sm" />
  ) : (
    <>
      {icon && !iconTrailing && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
      {icon && iconTrailing && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
    </>
  );

  return (
    <button
      type="button"
      className={cn(styles.button, VARIANT_CLASS[variant], { [styles.fab]: fab })}
      disabled={disabled}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onClick={handleClick}
    >
      {content}
    </button>
  );
}
