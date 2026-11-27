import React from 'react';
import { cn } from '@/shared/utils/cn';
import jikuSymbol from '@root/assets/jikuLogo.svg';
import styles from './Avatar.module.scss';

export type AvatarVariant = 'person' | 'app';
export type AvatarSize = 'sm' | 'md';

export interface AvatarProps {
  readonly variant?: AvatarVariant;
  readonly name: string;
  readonly size?: AvatarSize;
  /** El nombre se muestra visible junto al avatar (el avatar pasa a ser decorativo). */
  readonly nameVisible?: boolean;
  /**
   * Cantidad de responsables adicionales no representados. Se muestra fuera del
   * avatar, en `text.secondary`, con un texto accesible en palabras ("y 1
   * responsable más"), nunca sólo con el glifo "+1".
   */
  readonly extraCount?: number;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: styles.sm,
  md: styles.md,
};

/**
 * Deriva dos iniciales en mayúscula a partir de un nombre completo. El spec
 * prohíbe explícitamente mostrar una sola inicial: si el nombre es una sola
 * palabra, se toman sus dos primeras letras.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0]?.[0] ?? '').toUpperCase();
}

export function Avatar({
  variant = 'person',
  name,
  size = 'sm',
  nameVisible = false,
  extraCount,
}: AvatarProps) {
  const isPerson = variant === 'person';
  const initials = isPerson ? getInitials(name) : undefined;

  const avatarNode = (
    <span
      className={cn(styles.avatar, SIZE_CLASS[size])}
      aria-hidden={nameVisible ? 'true' : undefined}
      aria-label={!nameVisible ? name : undefined}
    >
      {isPerson ? (
        initials
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- símbolo fijo, sin optimización de next/image necesaria
        <img src={jikuSymbol.src ?? (jikuSymbol as unknown as string)} alt="" className={styles.symbol} />
      )}
    </span>
  );

  if (extraCount && extraCount > 0) {
    return (
      <span className={styles.withExtra}>
        {avatarNode}
        <span className={styles.extraCount} aria-hidden="true">
          +{extraCount}
        </span>
        <span className={styles.srOnly}>
          y {extraCount} responsable{extraCount === 1 ? '' : 's'} más
        </span>
      </span>
    );
  }

  return avatarNode;
}
