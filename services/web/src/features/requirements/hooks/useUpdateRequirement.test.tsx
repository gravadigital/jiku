import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementHeader } from '../components/RequirementHeader/RequirementHeader';
import { useUpdateRequirement } from './useUpdateRequirement';
import type { Requirement } from '../types/requirement.types';

// El barrel `@/shared/components/ui` (Badge, Button, que RequirementHeader consume desde
// S-057) arrastra transitivamente CommentEditor -> @/features/objectives -> auth. Sin estos
// mocks, la resolución real de 'next-auth' falla al buscar 'next/server' en este entorno de
// test. Mismo patrón que RequirementList.test.tsx / RequirementHeader.test.tsx.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

const baseRequirement: Requirement = {
  id: 5,
  title: 'Req test',
  description: '',
  type: 'funcionalidad',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: null,
  projectId: 1,
  project: { id: 1, name: 'PRJ-1' },
  responsiblePeople: [],
  createdBy: 'ivan@grava.io',
  creator: { id: 'u1', name: 'Iván López', email: 'ivan@grava.io' },
  tags: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  activity: [],
  resolutionConclusion: null,
  scope: null,
  technicalSolution: null,
  acceptanceCriteria: null,
};

describe('useUpdateRequirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('onMutate aplica el update optimista y onError revierte al valor previo del cache (mecanismo base del rollback, S-087)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(['requirement', 5], baseRequirement);

    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetch).mockReturnValue(fetchPromise);

    const { result } = renderHook(() => useUpdateRequirement(), { wrapper: Wrapper });
    result.current.mutate({ reqid: 5, payload: { state: 'resuelto' } });

    // Mientras la mutación está en vuelo (fetch todavía no resolvió), el cache ya
    // refleja el update optimista aplicado por onMutate.
    await waitFor(() => {
      expect(queryClient.getQueryData<Requirement>(['requirement', 5])?.state).toBe('resuelto');
    });

    resolveFetch!({
      ok: false,
      json: () => Promise.resolve({ message: 'Incidencia sin resolución completa' }),
    } as Response);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<Requirement>(['requirement', 5])?.state).toBe('analisis');
  });

  it('TS-9 (integración): incidencia sin resolución completa — 400 del gate — la Pill Estado del header vuelve a "Análisis" (S-087)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const incidencia: Requirement = { ...baseRequirement, type: 'incidencia', state: 'analisis' };
    queryClient.setQueryData(['requirement', 5], incidencia);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Incidencia sin resolución completa' }),
    } as Response);

    function Harness() {
      const { mutate } = useUpdateRequirement();
      const [current, setCurrent] = React.useState(incidencia);
      React.useEffect(() => {
        const unsubscribe = queryClient.getQueryCache().subscribe(() => {
          const data = queryClient.getQueryData<Requirement>(['requirement', 5]);
          if (data) setCurrent(data);
        });
        return unsubscribe;
      }, []);
      return (
        <RequirementHeader
          requirement={current}
          onUpdate={(payload) => mutate({ reqid: 5, payload })}
        />
      );
    }

    render(<Harness />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText('Análisis'));
    fireEvent.click(screen.getByRole('option', { name: 'Resuelto' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/requirements/5',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ state: 'resuelto' }) })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Análisis')).toBeInTheDocument();
    });
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
  });

  it('TS-10: onError revierte con un error 500 (no solo el 400 del gate de incidencia) (S-087)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(['requirement', 5], baseRequirement);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Error interno' }),
    } as Response);

    const { result } = renderHook(() => useUpdateRequirement(), { wrapper: Wrapper });
    result.current.mutate({ reqid: 5, payload: { state: 'planificacion' } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<Requirement>(['requirement', 5])?.state).toBe('analisis');
  });

  it('TS-11: rollback aplica a un 404 (no solo al gate de incidencia), en transición planificacion→en_cola (S-087)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const enPlanificacion: Requirement = { ...baseRequirement, state: 'planificacion' };
    queryClient.setQueryData(['requirement', 5], enPlanificacion);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Requisito no encontrado' }),
    } as Response);

    const { result } = renderHook(() => useUpdateRequirement(), { wrapper: Wrapper });
    result.current.mutate({ reqid: 5, payload: { state: 'en_cola' } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<Requirement>(['requirement', 5])?.state).toBe('planificacion');
  });

  it('TS-12: en éxito, el cache queda con el valor devuelto por la API, sin residuos del snapshot (S-087)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(['requirement', 5], baseRequirement);
    const updated = { ...baseRequirement, state: 'planificacion' as const };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updated),
    } as Response);

    const { result } = renderHook(() => useUpdateRequirement(), { wrapper: Wrapper });
    result.current.mutate({ reqid: 5, payload: { state: 'planificacion' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData<Requirement>(['requirement', 5])?.state).toBe('planificacion');
  });

  it('invalida las queries "requirements" y "requirement" en onSuccess (comportamiento existente, sin regresión)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(['requirement', 5], baseRequirement);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...baseRequirement, state: 'planificacion' }),
    } as Response);

    const { result } = renderHook(() => useUpdateRequirement(), { wrapper: Wrapper });
    result.current.mutate({ reqid: 5, payload: { state: 'planificacion' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['requirements'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['requirement', 5] });
  });

  it('si no hay valor previo en el cache, onMutate no rompe (cache frío)', async () => {
    const { Wrapper, queryClient } = createWrapper();
    // Sin setQueryData previo — cache frío para este reqid.

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Error' }),
    } as Response);

    const { result } = renderHook(() => useUpdateRequirement(), { wrapper: Wrapper });
    result.current.mutate({ reqid: 999, payload: { state: 'planificacion' } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(['requirement', 999])).toBeUndefined();
  });
});
