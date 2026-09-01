import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProject } from '@/features/projects';
import ProjectDetail from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

vi.mock('@/features/projects', () => ({
  useProject: vi.fn(),
}));

vi.mock('@/features/projects/components/ProjectDescription', () => ({
  ProjectDescription: () => <div data-testid="project-description" />,
}));

vi.mock('@/features/projects/components/ProjectRequirementsSection', () => ({
  ProjectRequirementsSection: () => <div data-testid="project-requirements" />,
}));

vi.mock('@/features/projects/components/ProjectObjectivesSection', () => ({
  ProjectObjectivesSection: () => <div data-testid="project-objectives" />,
}));

vi.mock('@/features/projects/components/ProjectGeneralInfo', () => ({
  ProjectGeneralInfo: () => <div data-testid="project-general-info" />,
}));

vi.mock('@/features/projects/components/ProjectProperties', () => ({
  ProjectProperties: () => <div data-testid="project-properties" />,
}));

vi.mock('@/features/projects/components/ProjectAttachmentsSection', () => ({
  ProjectAttachmentsSection: () => <div data-testid="project-attachments" />,
}));

vi.mock('@/shared/components/ui', () => ({
  Loader: ({ label }: { label: string }) => <div data-testid="loader">{label}</div>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <React.Suspense fallback={null}>{children}</React.Suspense>
      </QueryClientProvider>
    );
  }
  return Wrapper;
};

const makeProject = () => ({
  id: 1,
  name: 'Proyecto Test',
  description: 'Descripción',
  status: 'activo',
  priority: 1,
  type: 'interno',
  visibility: 'interno',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

async function renderPage(params: { id: number }) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProjectDetail params={Promise.resolve(params)} />, {
      wrapper: createWrapper(),
    });
    await Promise.resolve();
  });
  return result!;
}

describe('ProjectDetail page — layout y header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra Loader mientras carga el proyecto', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useProject>);

    await renderPage({ id: 1 });
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('muestra el título del proyecto en el header', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: makeProject(),
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);

    await renderPage({ id: 1 });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Proyecto Test');
  });

  it('muestra botón Volver en el header', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: makeProject(),
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);

    await renderPage({ id: 1 });
    expect(screen.getByRole('link', { name: /volver/i })).toBeInTheDocument();
  });

  it('muestra botón Editar en el header', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: makeProject(),
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);

    await renderPage({ id: 1 });
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
  });

  it('renderiza los componentes de la columna izquierda', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: makeProject(),
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);

    await renderPage({ id: 1 });
    expect(screen.getByTestId('project-description')).toBeInTheDocument();
    expect(screen.getByTestId('project-requirements')).toBeInTheDocument();
  });

  // La sección de etapas se eliminó junto con el concepto de etapas: quedaba un
  // `<div className={styles.card}>` vacío que seguía pintando borde, padding y sombra.
  it('no deja tarjetas vacías en el detalle', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: makeProject(),
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);

    const { container } = await renderPage({ id: 1 });
    const emptyCards = Array.from(container.querySelectorAll('[class*="card"]')).filter(
      card => card.children.length === 0 && card.textContent?.trim() === '',
    );
    expect(emptyCards).toHaveLength(0);
  });

  it('renderiza los componentes de la columna derecha', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: makeProject(),
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);

    await renderPage({ id: 1 });
    expect(screen.getByTestId('project-general-info')).toBeInTheDocument();
    expect(screen.getByTestId('project-properties')).toBeInTheDocument();
    expect(screen.getByTestId('project-attachments')).toBeInTheDocument();
  });
});
