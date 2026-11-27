import Image from 'next/image';
import Link from 'next/link';
import { parseExternalLinks } from '@/shared/utils/parse-external-links';
import styles from './styles.module.scss';

interface ExternalLinksBlockProps {
  /** JSON con los enlaces a las herramientas del equipo. Ver `parseExternalLinks`. */
  readonly externalLinks?: string;
}

// D-3: SidebarNav no tiene concepto de enlaces externos (su `items` no admite target ni
// sección separada, y el spec del DS no los menciona). Se conservan acá, renderizados en el
// shell junto a SidebarNav, no dentro de él. Los logos de terceros conservan su color
// original (foundations/logo.md § Coexistencia): por eso NO usan TintedIcon.
export function ExternalLinksBlock({ externalLinks }: ExternalLinksBlockProps) {
  const links = parseExternalLinks(externalLinks);

  if (links.length === 0) {
    return null;
  }

  return (
    <div className={styles.externalLinksGrid}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalLinkItem}
          title={link.label}
        >
          <Image src={link.icon} alt={link.label} width={20} height={20} />
        </Link>
      ))}
    </div>
  );
}
