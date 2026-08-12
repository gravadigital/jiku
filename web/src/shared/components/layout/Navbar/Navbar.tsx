'use client';
import 'react-toastify/dist/ReactToastify.css';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { NavItem } from '@/shared/components/layout/NavItem';
import { NavSubItem } from '@/shared/components/layout/NavSubItem';
import actoresLogo from '@root/assets/actoresLogo.svg';
import externalLogoGithub from '@root/assets/ExternalLogos/github.svg';
import externalLogoHedgedoc from '@root/assets/ExternalLogos/hedgedoc.svg';
import externalLogoHoras from '@root/assets/ExternalLogos/horas.svg';
import externalLogoMail from '@root/assets/ExternalLogos/mailu.png';
import externalLogoMattermost from '@root/assets/ExternalLogos/mattermost.svg';
import appLogo from '@root/assets/logoLayout.png';
import logoutLogo from '@root/assets/logoutLogo.svg';
import objectivesLogo from '@root/assets/objetivosLogo.svg';
import projectsLogo from '@root/assets/proyectosLogo.svg';
import requirementsLogo from '@root/assets/requisitosLogo.svg';
import timeAllocationLogo from '@root/assets/schedule-icon.svg';
import styles from './Navbar.module.scss';

// Types
interface NavSubItemConfig {
  readonly href: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly exact?: boolean;
}

interface NavItemConfig {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly subItems?: NavSubItemConfig[];
}

interface ExternalLinkConfig {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}

// Navigation configuration
const NAV_ITEMS: NavItemConfig[] = [
  {
    href: '/clients',
    icon: actoresLogo,
    label: 'Actores',
  },
  {
    href: '/projects',
    icon: projectsLogo,
    label: 'Proyectos',
  },
  {
    href: '/requirements',
    icon: requirementsLogo,
    label: 'Requisitos',
  },
  {
    href: '/objectives',
    icon: objectivesLogo,
    label: 'Tareas',
    subItems: [
      {
        href: '/objectives/by-project',
        label: 'Por proyecto',
      },
      {
        href: '/objectives/by-responsible',
        label: 'Por responsable',
      },
    ],
  },
  {
    href: '/time-allocation',
    icon: timeAllocationLogo,
    label: 'Asignación de Tiempo',
  },
  {
    href: '/worked-times',
    icon: externalLogoHoras,
    label: 'Horas Trabajadas',
    subItems: [
      {
        href: '/worked-times',
        label: 'Carga',
        exact: true,
      },
      {
        href: '/worked-times/report',
        label: 'Visualización',
      },
    ],
  },
];

/**
 * Accesos directos a las herramientas del equipo, en el pie de la navegación.
 *
 * Se configuran con `EXTERNAL_LINKS`, un JSON con la forma
 * `[{"tool":"github","href":"https://...","label":"Código"}]`. Sin esa variable el
 * bloque no se muestra: son enlaces a la infraestructura de cada equipo, no del producto.
 *
 * `tool` elige el ícono entre los disponibles; si no coincide con ninguno, se usa el
 * genérico.
 */
const EXTERNAL_LINK_ICONS: Record<string, typeof externalLogoGithub> = {
  github: externalLogoGithub,
  gitlab: externalLogoGithub,
  hedgedoc: externalLogoHedgedoc,
  mattermost: externalLogoMattermost,
  mail: externalLogoMail,
};

export function parseExternalLinks(raw?: string): ExternalLinkConfig[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as { tool?: string; href: string; label: string }[];
    return parsed
      .filter((link) => link.href && link.label)
      .map((link) => ({
        href: link.href,
        label: link.label,
        icon: EXTERNAL_LINK_ICONS[link.tool ?? ''] ?? externalLogoGithub,
      }));
  } catch {
    // Una variable mal formada no debería tumbar la navegación entera.
    console.error('La configuración de enlaces externos no es un JSON válido; se ignora.');
    return [];
  }
}

// Helper function to check if a path is active
function isPathActive(currentPath: string, itemPath: string): boolean {
  return currentPath.startsWith(itemPath);
}

// Helper function to check if a parent item should be active
function isParentActive(currentPath: string, item: NavItemConfig): boolean {
  if (isPathActive(currentPath, item.href)) {
    return true;
  }

  if (item.subItems) {
    return item.subItems.some((subItem) => isPathActive(currentPath, subItem.href));
  }

  return false;
}

// Helper to filter navigation items by user role
function getVisibleNavItems(isExternalUser: boolean): NavItemConfig[] {
  if (isExternalUser) {
    return NAV_ITEMS.filter(
      (item) => item.href !== '/time-allocation' && item.href !== '/worked-times'
    );
  }
  return NAV_ITEMS;
}

interface NavbarProps {
  /** Nombre de la aplicación, para el alt del logo. */
  readonly appName?: string;
  /** JSON con los enlaces a las herramientas del equipo. Ver `parseExternalLinks`. */
  readonly externalLinks?: string;
}

export function Navbar({ appName, externalLinks }: NavbarProps) {
  const EXTERNAL_LINKS = parseExternalLinks(externalLinks);
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
  const isExternalUser = userRoles.includes('external-user');

  const visibleNavItems = getVisibleNavItems(isExternalUser);

  const handleLogout = () => {
    return signOut({ callbackUrl: '/login' });
  };

  return (
    <nav className={styles.navBarContainer}>
      <div className={styles.navBarLogo}>
        <Link href="/">
          <Image src={appLogo} alt={appName ?? 'Jiku'} height={55} />
        </Link>
      </div>

      <ul className={styles.navLinksContainer}>
        {visibleNavItems.map((item) => {
          const isActive = isParentActive(pathname, item);

          return (
            <div key={item.href} className={styles.navGroup}>
              <NavItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive}
                disabled={item.disabled}
              />

              {item.subItems?.map((subItem) => (
                <NavSubItem
                  key={`${subItem.href}-${subItem.label}`}
                  href={subItem.href}
                  icon={item.icon}
                  label={subItem.label}
                  active={
                    subItem.exact ? pathname === subItem.href : isPathActive(pathname, subItem.href)
                  }
                  disabled={subItem.disabled}
                />
              ))}
            </div>
          );
        })}
      </ul>

      <div className={styles.bottomSection}>
        <div className={styles.externalLinksGrid}>
          {EXTERNAL_LINKS.map((link) => (
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

        <ul className={styles.logout}>
          <NavItem
            label="Cerrar sesión"
            href="#"
            active={false}
            icon={logoutLogo}
            handleClick={handleLogout}
          />
        </ul>
      </div>
    </nav>
  );
}
