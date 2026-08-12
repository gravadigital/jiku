import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/features/projects/components/Sidebar/Sidebar';
import { vi } from 'vitest';

const mockPush = vi.fn();
let mockPathname = '/projects/42/requirements';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Juan López', email: 'juan@exo.com' } },
  }),
  signOut: vi.fn(),
}));

vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      { id: 42, name: 'EXO Videoconferencia' },
      { id: 99, name: 'EXO CDM FLOW' },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockPathname = '/projects/42/requirements';
});

// TS-1: Logo con fondo azul y border-radius
describe('CA-1: Logo con diseño del prototipo', () => {
  it('renderiza el texto "Opus" dentro del logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('Opus')).toBeInTheDocument();
  });

  it('el elemento logoText tiene la clase CSS correcta', () => {
    render(<Sidebar />);
    const logoText = screen.getByText('Opus');
    expect(logoText.className).toMatch(/logoText/);
  });
});

// TS-2: Ítem activo resaltado
describe('CA-2: Ítem activo resaltado correctamente', () => {
  it('el proyecto activo (id=42) tiene clase "active"', () => {
    render(<Sidebar />);
    const activeItem = screen.getByText('EXO Videoconferencia').closest('[class*="navItem"]');
    expect(activeItem?.className).toMatch(/active/);
  });
});

// TS-3: Ítems inactivos sin resaltado + navegación
describe('CA-3: Ítems inactivos sin resaltado y navegación correcta', () => {
  it('el proyecto inactivo (id=99) NO tiene clase "active"', () => {
    render(<Sidebar />);
    const inactiveItem = screen.getByText('EXO CDM FLOW').closest('[class*="navItem"]');
    expect(inactiveItem?.className).not.toMatch(/active/);
  });

  it('al hacer click en proyecto inactivo navega a /projects/99/requirements?view=list', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText('EXO CDM FLOW'));
    expect(mockPush).toHaveBeenCalledWith('/projects/99/requirements?view=list');
  });
});

// TS-1 (S-015): Botón muestra "Nuevo requisito"
describe('CA-1 (S-015): Botón "Nuevo requisito" en el footer', () => {
  it('existe un botón con texto "Nuevo requisito"', () => {
    render(<Sidebar />);
    expect(screen.getByText('Nuevo requisito')).toBeInTheDocument();
  });

  it('el botón "Nuevo requisito" es un elemento button', () => {
    render(<Sidebar />);
    const btn = screen.getByText('Nuevo requisito').closest('button');
    expect(btn).toBeInTheDocument();
  });
});

// TS-2 (S-015): Click en botón llama onNewObjective
describe('CA-2 (S-015): Click en botón llama onNewObjective', () => {
  it('llama onNewObjective al hacer click en el botón', () => {
    const onNewObjective = vi.fn();
    render(<Sidebar onNewObjective={onNewObjective} />);
    fireEvent.click(screen.getByText('Nuevo requisito').closest('button')!);
    expect(onNewObjective).toHaveBeenCalledTimes(1);
  });

  it('no lanza error si onNewObjective no es provista', () => {
    render(<Sidebar />);
    expect(() => {
      fireEvent.click(screen.getByText('Nuevo requisito').closest('button')!);
    }).not.toThrow();
  });
});

// TS-5: Sección de usuario con nombre y email
describe('CA-5: Sección de usuario con avatar, nombre y email', () => {
  it('muestra el nombre del usuario "Juan López"', () => {
    render(<Sidebar />);
    expect(screen.getByText('Juan López')).toBeInTheDocument();
  });

  it('muestra el email del usuario "juan@exo.com"', () => {
    render(<Sidebar />);
    expect(screen.getByText('juan@exo.com')).toBeInTheDocument();
  });
});

// TS-6: Sidebar oculto en mobile vía CSS
describe('CA-6: Sidebar oculto en mobile', () => {
  it('el archivo SCSS contiene @include mobile con display: none', () => {
    const scssPath = path.resolve(
      __dirname,
      '../../../../../src/features/projects/components/Sidebar/Sidebar.module.scss'
    );
    const content = fs.readFileSync(scssPath, 'utf-8');
    expect(content).toMatch(/@include mobile/);
    expect(content).toMatch(/display:\s*none/);
  });
});
