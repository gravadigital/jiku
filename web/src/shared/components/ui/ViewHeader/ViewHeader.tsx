import React from 'react';
import Link from 'next/link';
import { Badge, type BadgeVariant, type BadgeFamily } from '../Badge';
import { Button, type ButtonProps } from '../Button';
import styles from './ViewHeader.module.scss';

export type ViewHeaderVariant = 'list' | 'breadcrumb' | 'detail';

export interface ViewHeaderParent {
  readonly label: string;
  readonly href: string;
}

export interface ViewHeaderBadge {
  readonly variant?: BadgeVariant;
  readonly family?: BadgeFamily;
  readonly label: string;
}

export interface ViewHeaderProps {
  readonly variant?: ViewHeaderVariant;
  readonly title: string;
  readonly parent?: ViewHeaderParent;
  /** Sólo tiene efecto visual en variant `detail`. */
  readonly badges?: readonly ViewHeaderBadge[];
  readonly action?: Pick<ButtonProps, 'children' | 'onClick' | 'variant' | 'disabled' | 'loading'>;
}

export function ViewHeader({ variant = 'list', title, parent, badges, action }: ViewHeaderProps) {
  return (
    <header className={styles.header}>
      {parent && (
        <nav aria-label="Ruta" className={styles.breadcrumbNav}>
          <ol className={styles.breadcrumbList}>
            <li>
              <Link href={parent.href} className={styles.breadcrumbParent}>
                {parent.label}
              </Link>
            </li>
            <li>
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {title}
              </span>
            </li>
          </ol>
        </nav>
      )}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {variant === 'detail' && badges && badges.length > 0 && (
          <div className={styles.badges}>
            {badges.map((badge) => (
              <Badge
                key={badge.label}
                variant={(badge.variant as Exclude<BadgeVariant, 'editable'>) ?? 'state'}
                family={badge.family}
                label={badge.label}
              />
            ))}
          </div>
        )}
        {action && (
          <div className={styles.action}>
            <Button {...action} />
          </div>
        )}
      </div>
    </header>
  );
}
