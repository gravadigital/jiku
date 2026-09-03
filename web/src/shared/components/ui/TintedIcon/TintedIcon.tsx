import React from 'react';
import styles from './TintedIcon.module.scss';
import type { StaticImageData } from 'next/image';

interface TintedIconProps {
  readonly src: StaticImageData | string;
  readonly alt: string;
  readonly color?: string;
  readonly size?: number;
  readonly className?: string;
}

// Default: color.brand.graphite, el tono normativo para íconos/estructura del DS.
// El magenta descontinuado (dado de baja en S-060) nunca es un default aceptable — ver TS-20/TS-49.
// (Referencia de hex evitada deliberadamente en este comentario: TS-19/TS-48 recorren
// también comentarios de .tsx en el alcance ampliado del guardia — ver docs/design-system/
// web/foundations/color.md para los valores exactos de cada token.)
export function TintedIcon({
  src,
  alt,
  color = 'var(--color-graphite)',
  size = 20,
  className,
}: TintedIconProps) {
  const resolvedSrc = typeof src === 'string' ? src : src.src;

  return (
    <span
      role="img"
      aria-label={alt}
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={
        {
          backgroundColor: color,
          width: size,
          height: size,
          '--icon-mask-url': `url(${resolvedSrc})`,
        } as React.CSSProperties
      }
    />
  );
}
