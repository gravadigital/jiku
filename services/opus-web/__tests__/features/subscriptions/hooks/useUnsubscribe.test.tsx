import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnsubscribe } from '@/features/subscriptions/hooks/useUnsubscribe';
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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUnsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama a subscriptionsApi.unsubscribe con los parámetros correctos', async () => {
    mockSubscriptionsApi.unsubscribe.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUnsubscribe({ requirementId: 123 }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('user-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSubscriptionsApi.unsubscribe).toHaveBeenCalledWith(123, 'user-1');
  });

  it('retorna isPending: true durante la mutación', async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockSubscriptionsApi.unsubscribe.mockImplementationOnce(() => pendingPromise);

    const { result } = renderHook(() => useUnsubscribe({ requirementId: 123 }), {
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
    mockSubscriptionsApi.unsubscribe.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useUnsubscribe({ requirementId: 123 }), {
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

    mockSubscriptionsApi.unsubscribe.mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUnsubscribe({ requirementId: 456 }), { wrapper });

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
