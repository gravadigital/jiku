import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCanEditObjective } from './useCanEditObjective';
import { useObjective } from './useObjective';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('./useObjective', () => ({
  useObjective: vi.fn(),
}));

const mockUseSession = useSession as ReturnType<typeof vi.fn>;
const mockUseObjective = useObjective as ReturnType<typeof vi.fn>;

const makeObjective = (overrides = {}) => ({
  id: 10,
  creator: { id: 'zit-1' },
  persons: [{ userId: 'zit-2' }],
  ...overrides,
});

describe('useCanEditObjective', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna false cuando no hay sesión', () => {
    mockUseSession.mockReturnValue({ data: null });
    mockUseObjective.mockReturnValue({ data: makeObjective() });

    const { result } = renderHook(() => useCanEditObjective(10));
    expect(result.current).toBe(false);
  });

  it('retorna false cuando el objetivo aún no cargó', () => {
    mockUseSession.mockReturnValue({ data: { user: { zitadelId: 'zit-1', roles: [] } } });
    mockUseObjective.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useCanEditObjective(10));
    expect(result.current).toBe(false);
  });

  it('retorna true cuando el usuario es admin', () => {
    mockUseSession.mockReturnValue({ data: { user: { zitadelId: 'zit-99', roles: ['admin'] } } });
    mockUseObjective.mockReturnValue({ data: makeObjective() });

    const { result } = renderHook(() => useCanEditObjective(10));
    expect(result.current).toBe(true);
  });

  it('retorna true cuando el usuario es el creador', () => {
    mockUseSession.mockReturnValue({ data: { user: { zitadelId: 'zit-1', roles: [] } } });
    mockUseObjective.mockReturnValue({ data: makeObjective({ creator: { id: 'zit-1' } }) });

    const { result } = renderHook(() => useCanEditObjective(10));
    expect(result.current).toBe(true);
  });

  it('retorna true cuando el usuario está asignado (persons)', () => {
    mockUseSession.mockReturnValue({ data: { user: { zitadelId: 'zit-2', roles: [] } } });
    mockUseObjective.mockReturnValue({
      data: makeObjective({
        creator: { id: 'zit-1' },
        persons: [{ userId: 'zit-2' }],
      }),
    });

    const { result } = renderHook(() => useCanEditObjective(10));
    expect(result.current).toBe(true);
  });

  it('retorna false cuando el usuario no tiene ningún permiso', () => {
    mockUseSession.mockReturnValue({ data: { user: { zitadelId: 'zit-99', roles: [] } } });
    mockUseObjective.mockReturnValue({
      data: makeObjective({
        creator: { id: 'zit-1' },
        persons: [{ userId: 'zit-2' }],
      }),
    });

    const { result } = renderHook(() => useCanEditObjective(10));
    expect(result.current).toBe(false);
  });
});
