import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import externalLinkIcon from '@root/assets/externalLink.svg';
import styles from './NavSubItem.module.scss';

interface NavItemProps {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  readonly disabled?: boolean;
  readonly active: boolean;
  readonly external?: boolean;
  readonly handleClick?: () => void;
}

export function NavSubItem(props: NavItemProps) {
  const {
    label,
    href,
    icon,
    disabled = false,
    active,
    external = false,
    handleClick = null,
  } = props;

  const onClick = (event: any) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (handleClick) {
      handleClick();
    }
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      target={external ? '_blank' : ''}
      rel={external ? 'noopener noreferrer' : undefined}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
    >
      <div className={`${styles.containerNavSubItem}`}>
        <div
          className={`${styles.navSubItem}
        ${disabled && styles.disabled}
        ${active && styles.active}
        ${external && styles.external}`}
        >
          <div className={styles.iconContainer}>
            <Image src={icon} alt="" width={16} height={16} aria-hidden="true" />
          </div>
          <span>{label}</span>
        </div>
        <div>
          <div>
            {external === true && (
              <div className={styles.externalLinkIcon}>
                <Image alt="" src={externalLinkIcon} height={15} aria-hidden="true" />
                <span className="sr-only">(abre en nueva ventana)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
