import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import externalLinkIcon from '@root/assets/externalLink.svg';
import styles from './NavItem.module.scss';

interface NavItemProps {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  readonly disabled?: boolean;
  readonly active: boolean;
  readonly external?: boolean;
  readonly handleClick?: () => void;
}

export function NavItem(props: NavItemProps) {
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
      <div
        className={`${styles.navItem}
        ${disabled && styles.disabled}
        ${active && styles.active}
        ${external && styles.external}`}
      >
        <div className={styles.iconContainer}>
          <Image src={icon} alt="" width={25} height={25} aria-hidden="true" />
        </div>
        <span>{label}</span>
        {external === true && (
          <>
            <Image alt="" src={externalLinkIcon} height={18} aria-hidden="true" />
            <span className="sr-only">(abre en nueva ventana)</span>
          </>
        )}
      </div>
    </Link>
  );
}
