import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { describe, expect, it, vi } from 'vitest';
import { useCurrentUser } from './use-current-user';

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }));

const JIKU_ID = '7f3c2a10-0000-4000-8000-000000000001';
const session = (data: unknown) => vi.mocked(useSession).mockReturnValue({ data } as never);

describe('useCurrentUser', () => {
  it('TS-1: expone zitadelId', () => {
    session({ user: { id: JIKU_ID, name: 'Yo', roles: ['user'], zitadelId: 'sub-yo' } });
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toEqual({ id: JIKU_ID, name: 'Yo', zitadelId: 'sub-yo' });
  });

  it('TS-2: sin zitadelId en la sesión devuelve null', () => {
    session({ user: { id: JIKU_ID, name: 'Yo', roles: ['user'] } });
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toEqual({ id: JIKU_ID, name: 'Yo', zitadelId: null });
  });

  it('TS-3: sin sesión devuelve null', () => {
    session(null);
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBeNull();
  });
});
