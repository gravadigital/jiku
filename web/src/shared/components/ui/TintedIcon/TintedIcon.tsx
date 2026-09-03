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

// Default: color.brand.graphite (#626C78), el tono normativo para íconos/estructura del DS.
// El magenta descontinuado (#DA2C6A) nunca es un default aceptable — ver TS-20/TS-49.
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
