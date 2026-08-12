import { renderHook, act } from '@testing-library/react';
import { useLogout } from '@/shared/hooks/useLogout';
import { signOut } from 'next-auth/react';
import { vi, type Mock } from 'vitest';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('useLogout', () => {
  beforeEach(() => {
    (signOut as Mock).mockClear();
  });

  it('retorna una función que llama signOut con callbackUrl /login (TS-1)', () => {
    const { result } = renderHook(() => useLogout());

    act(() => {
      result.current();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });
});
