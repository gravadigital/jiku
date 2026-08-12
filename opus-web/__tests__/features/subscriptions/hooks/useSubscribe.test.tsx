import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubscribe } from '@/features/subscriptions/hooks/useSubscribe';
import { subscriptionsApi } from '@/features/subscriptions/services/subscriptionsApi';
import { vi, type Mocked } from 'vitest';

vi.mock('@/features/subscriptions/services/subscriptionsApi');
const mockSubscriptionsApi = subscriptionsApi as Mocked<typeof subscriptionsApi>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama a subscriptionsApi.subscribe con los parámetros correctos', async () => {
    mockSubscriptionsApi.subscribe.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSubscribe({ requirementId: 123 }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('user-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSubscriptionsApi.subscribe).toHaveBeenCalledWith(123, 'user-1');
  });

  it('retorna isPending: true durante la mutación', async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockSubscriptionsApi.subscribe.mockImplementationOnce(() => pendingPromise);

    const { result } = renderHook(() => useSubscribe({ requirementId: 123 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('user-1');
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => {
      resolvePromise!();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('retorna error cuando la API falla', async () => {
    const errorMessage = 'Internal server error';
    mockSubscriptionsApi.subscribe.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useSubscribe({ requirementId: 123 }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('user-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error(errorMessage));
  });

  it('invalida el query del objetivo tras éxito', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mockSubscriptionsApi.subscribe.mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSubscribe({ requirementId: 456 }), { wrapper });

    await act(async () => {
      result.current.mutate('user-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['requirement', 456],
    });

    invalidateQueriesSpy.mockRestore();
  });
});
