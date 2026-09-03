import React, { ElementType } from 'react';
import Link from 'next/link';
import { cn } from '@/shared/utils/cn';
import { Badge, type BadgeFamily } from '../Badge';
import styles from './Card.module.scss';

type CardVariant = 'project' | 'task' | 'task-overdue' | 'panel' | 'metric';

interface CardStatus {
  readonly family: BadgeFamily;
  readonly label: string;
}

interface CardMetric {
  readonly label: string;
  readonly value: string;
  readonly overdue?: boolean;
}

interface CardTag {
  readonly label: string;
  readonly family?: BadgeFamily;
}

interface CardProps {
  readonly variant?: CardVariant;
  readonly title?: string;
  /** Si está presente, la tarjeta es navegable: el título es el único destino accesible. */
  readonly href?: string;
  readonly status?: CardStatus;
  readonly tags?: CardTag[];
  readonly metrics?: CardMetric[];
  /** Nivel del heading del título. El consumidor lo elige según la vista. */
  readonly headingLevel?: 'h2' | 'h3' | 'h4';
  readonly children?: React.ReactNode;
  readonly header?: React.ReactNode;
  readonly footer?: React.ReactNode;
}

export function Card(props: CardProps) {
  const {
    variant = 'panel',
    title,
    href,
    status,
    tags,
    metrics,
    headingLevel = 'h3',
    children,
    header,
    footer,
  } = props;

  const Heading = headingLevel as ElementType;
  const isOverdue = variant === 'task-overdue' || Boolean(metrics?.some((metric) => metric.overdue));

  return (
    <div className={cn(styles.card, styles[toCamel(variant)])}>
      {(header || status) && (
        <div className={styles.header}>
          {header}
          {status && <Badge variant="state" family={status.family} label={status.label} />}
        </div>
      )}
      {title && (
        <Heading className={styles.title}>
          {href ? (
            <Link href={href} className={styles.titleLink}>
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
      )}
      {children && <div className={styles.body}>{children}</div>}
      {tags && tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map((tag) => (
            <Badge key={tag.label} variant="card-tag" family={tag.family} label={tag.label} />
          ))}
        </div>
      )}
      {variant === 'metric' && metrics && metrics.length > 0 && (
        <div className={styles.metricDisplay}>
          <span className={styles.metricValue}>{metrics[0].value}</span>
          <span className={styles.metricLabel}>{metrics[0].label}</span>
        </div>
      )}
      {variant !== 'metric' && metrics && metrics.length > 0 && (
        <div className={cn(styles.footer, { [styles.overdue]: isOverdue })}>
          {metrics.map((metric) => (
            <span
              key={metric.label}
              className={cn(styles.metric, { [styles.metricOverdue]: Boolean(metric.overdue) })}
            >
              {metric.value}
            </span>
          ))}
        </div>
      )}
      {footer}
    </div>
  );
}

function toCamel(variant: CardVariant): string {
  return variant.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
