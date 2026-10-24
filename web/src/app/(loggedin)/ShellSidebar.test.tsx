import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useModule } from '@/features/docs';
import { ShellSidebar } from './ShellSidebar';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/projects'),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));
vi.mock('@/features/theme', () => ({
  ThemeToggle: () => <div />,
  useTheme: () => ({ theme: 'light' }),
}));
vi.mock('@/features/docs', () => ({ useModule: vi.fn() }));

const setModule = (status: 'not_installed' | 'unavailable' | 'available', isKnown = true) =>
  vi.mocked(useModule).mockReturnValue({ status, sharing: false, isKnown });

describe('ShellSidebar — ítem Documentación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/projects');
  });

  it('TS-14: sin módulo no hay ítem y siguen los 6 existentes', () => {
    setModule('not_installed');
    render(<ShellSidebar isExternalUser={false} userName="Ana" />);
    expect(screen.queryByRole('link', { name: 'Documentación' })).toBeNull();
    for (const name of [
      'Actores',
      'Proyectos',
      'Requisitos',
      'Tareas',
      'Asignación de Tiempo',
      'Horas Trabajadas',
    ]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('TS-15: con módulo disponible el ítem es el último y queda activo en /docs/*', () => {
    setModule('available');
    vi.mocked(usePathname).mockReturnValue('/docs/01J9Z3K8M2Q4R6T8V0W2Y4A6C8');
    render(<ShellSidebar isExternalUser={false} userName="Ana" />);
    const link = screen.getByRole('link', { name: 'Documentación' });
    expect(link).toHaveAttribute('href', '/docs');
    expect(link).toHaveAttribute('aria-current', 'page');
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h): h is string => Boolean(h));
    const mainNav = hrefs.filter((h) =>
      [
        '/clients',
        '/projects',
        '/requirements',
        '/objectives',
        '/time-allocation',
        '/worked-times',
        '/docs',
      ].includes(h)
    );
    expect(mainNav[mainNav.length - 1]).toBe('/docs');
  });

  it('TS-16: con módulo caído el ítem sigue visible', () => {
    setModule('unavailable');
    render(<ShellSidebar isExternalUser={false} userName="Ana" />);
    expect(screen.getByRole('link', { name: 'Documentación' })).toBeInTheDocument();
  });

  it('TS-17: mientras GET /modules carga no hay ítem', () => {
    setModule('not_installed', false);
    render(<ShellSidebar isExternalUser={false} userName="Ana" />);
    expect(screen.queryByRole('link', { name: 'Documentación' })).toBeNull();
  });

  it('un external-user con el módulo instalado también ve el ítem (el corte real es la página)', () => {
    setModule('available');
    render(<ShellSidebar isExternalUser userName="Ana" />);
    expect(screen.getByRole('link', { name: 'Documentación' })).toBeInTheDocument();
  });
});
