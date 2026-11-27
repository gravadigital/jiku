import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { describe, expect, it, vi } from 'vitest';
import { useCanRestrictDocs } from './useCanRestrictDocs';

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }));

const session = (roles: string[]) =>
  ({ data: { user: { id: 'sub-yo', roles } } }) as unknown as ReturnType<typeof useSession>;

describe('useCanRestrictDocs (TS-14)', () => {
  it('solo admin', () => {
    vi.mocked(useSession).mockReturnValue(session(['admin']));
    expect(renderHook(() => useCanRestrictDocs()).result.current).toBe(true);
    vi.mocked(useSession).mockReturnValue(session(['user']));
    expect(renderHook(() => useCanRestrictDocs()).result.current).toBe(false);
    vi.mocked(useSession).mockReturnValue({ data: null } as unknown as ReturnType<
      typeof useSession
    >);
    expect(renderHook(() => useCanRestrictDocs()).result.current).toBe(false);
  });
});
