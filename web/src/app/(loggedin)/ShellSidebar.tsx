'use client';

import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ThemeToggle, useTheme } from '@/features/theme';
import { SidebarNav, type SidebarNavItem } from '@/shared/components/ui/SidebarNav';
import actoresLogo from '@root/assets/actoresLogo.svg';
import externalLogoHoras from '@root/assets/ExternalLogos/horas.svg';
import objectivesLogo from '@root/assets/objetivosLogo.svg';
import projectsLogo from '@root/assets/proyectosLogo.svg';
import requirementsLogo from '@root/assets/requisitosLogo.svg';
import timeAllocationLogo from '@root/assets/schedule-icon.svg';

// Reproduce los 6 ítems y 5 subítems de la navegación actual (Navbar.tsx), con sus rutas
// exactas. `key` es lo que el shell resuelve a partir de la ruta — SidebarNav no la consulta.
const NAV_ITEMS: SidebarNavItem[] = [
  { key: 'clients', label: 'Actores', icon: actoresLogo, href: '/clients' },
  { key: 'projects', label: 'Proyectos', icon: projectsLogo, href: '/projects' },
  {
    key: 'requirements',
    label: 'Requisitos',
    icon: requirementsLogo,
    href: '/requirements',
    children: [{ key: 'requirements-report', label: 'Reporte', href: '/requirements/report' }],
  },
  {
    key: 'objectives',
    label: 'Tareas',
    icon: objectivesLogo,
    href: '/objectives',
    children: [
      { key: 'objectives-by-project', label: 'Por proyecto', href: '/objectives/by-project' },
      {
        key: 'objectives-by-responsible',
        label: 'Por responsable',
        href: '/objectives/by-responsible',
      },
    ],
  },
  {
    key: 'time-allocation',
    label: 'Asignación de Tiempo',
    icon: timeAllocationLogo,
    href: '/time-allocation',
  },
  {
    key: 'worked-times',
    label: 'Horas Trabajadas',
    icon: externalLogoHoras,
    href: '/worked-times',
    children: [
      { key: 'worked-times-load', label: 'Carga', href: '/worked-times' },
      { key: 'worked-times-report', label: 'Visualización', href: '/worked-times/report' },
    ],
  },
];

// Ítems fuera del alcance de `external-user`: reproduce getVisibleNavItems() de Navbar.tsx.
// Rama prácticamente inalcanzable (el layout ya redirige a /unauthorized), pero no se elimina.
function getVisibleNavItems(isExternalUser: boolean): SidebarNavItem[] {
  if (isExternalUser) {
    return NAV_ITEMS.filter((item) => item.key !== 'time-allocation' && item.key !== 'worked-times');
  }
  return NAV_ITEMS;
}

// Mapeo ruta → activeKey. Reproduce Navbar.tsx: startsWith para los ítems, y el caso
// `exact: true` del subítem "Carga" (Navbar.tsx:91), que startsWith solo no distingue de
// "Visualización" (ambos empiezan con /worked-times).
function resolveActiveKey(pathname: string): string {
  if (pathname === '/worked-times') return 'worked-times-load';
  if (pathname.startsWith('/worked-times/report')) return 'worked-times-report';
  if (pathname.startsWith('/worked-times')) return 'worked-times';

  if (pathname.startsWith('/objectives/by-project')) return 'objectives-by-project';
  if (pathname.startsWith('/objectives/by-responsible')) return 'objectives-by-responsible';
  if (pathname.startsWith('/objectives')) return 'objectives';

  if (pathname.startsWith('/requirements/report')) return 'requirements-report';
  if (pathname.startsWith('/requirements')) return 'requirements';

  if (pathname.startsWith('/time-allocation')) return 'time-allocation';
  if (pathname.startsWith('/clients')) return 'clients';
  if (pathname.startsWith('/projects')) return 'projects';

  return '';
}

interface ShellSidebarProps {
  readonly isExternalUser: boolean;
  readonly userName: string;
}

export function ShellSidebar({ isExternalUser, userName }: ShellSidebarProps) {
  const pathname = usePathname();
  const items = getVisibleNavItems(isExternalUser);
  const activeKey = resolveActiveKey(pathname);
  // El shell es el consumidor correcto de useTheme(): SidebarNav no detecta el tema por sí
  // mismo (igual que no consulta la ruta para activeKey), así que `mode` se deriva acá,
  // no dentro de SidebarNav (S-059, cierra lo que S-058 dejó pendiente).
  const { theme } = useTheme();

  const handleLogout = () => {
    return signOut({ callbackUrl: '/login' });
  };

  return (
    <SidebarNav
      items={items}
      activeKey={activeKey}
      user={{ name: userName, initials: '' }}
      onLogout={handleLogout}
      mode={theme}
      footerSlot={<ThemeToggle />}
    />
  );
}
