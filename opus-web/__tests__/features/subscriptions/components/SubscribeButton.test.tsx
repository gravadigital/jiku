import { render, screen, fireEvent } from '@testing-library/react';
import type { Subscriber } from '@/features/subscriptions/types/subscription.types';
import { vi } from 'vitest';

const mockSubscribeMutate = vi.fn();
const mockUnsubscribeMutate = vi.fn();
let mockIsSubscribing = false;
let mockIsUnsubscribing = false;

vi.mock('@/features/subscriptions/hooks/useSubscribe', () => ({
  useSubscribe: () => ({ mutate: mockSubscribeMutate, isPending: mockIsSubscribing }),
}));

vi.mock('@/features/subscriptions/hooks/useUnsubscribe', () => ({
  useUnsubscribe: () => ({ mutate: mockUnsubscribeMutate, isPending: mockIsUnsubscribing }),
}));

// Import after mocks
import { SubscribeButton } from '@/features/subscriptions/components/SubscribeButton';

const subscriber: Subscriber = { id: 'u1', name: 'Ana López', email: 'ana@test.com' };
const otherSubscriber: Subscriber = { id: 'u2', name: 'Juan García', email: 'juan@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSubscribing = false;
  mockIsUnsubscribing = false;
});

describe('SubscribeButton', () => {
  it('TS-1: muestra "Suscribirse" cuando currentUserId no está en subscribers', () => {
    render(
      <SubscribeButton requirementId={1} currentUserId="u1" subscribers={[otherSubscriber]} />
    );
    expect(screen.getByRole('button', { name: 'Suscribirse' })).toBeInTheDocument();
  });

  it('TS-2: muestra "Desuscribirse" cuando currentUserId está en subscribers', () => {
    render(<SubscribeButton requirementId={1} currentUserId="u1" subscribers={[subscriber]} />);
    expect(screen.getByRole('button', { name: 'Desuscribirse' })).toBeInTheDocument();
  });

  it('TS-3: llama mutate de useSubscribe con currentUserId al click en "Suscribirse"', () => {
    render(<SubscribeButton requirementId={1} currentUserId="u1" subscribers={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suscribirse' }));
    expect(mockSubscribeMutate).toHaveBeenCalledWith('u1', expect.any(Object));
    expect(mockSubscribeMutate).toHaveBeenCalledTimes(1);
  });

  it('TS-4: llama mutate de useUnsubscribe con currentUserId al click en "Desuscribirse"', () => {
    render(<SubscribeButton requirementId={1} currentUserId="u1" subscribers={[subscriber]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desuscribirse' }));
    expect(mockUnsubscribeMutate).toHaveBeenCalledWith('u1', expect.any(Object));
    expect(mockUnsubscribeMutate).toHaveBeenCalledTimes(1);
  });

  it('TS-14: botón deshabilitado cuando isPending=true', () => {
    mockIsSubscribing = true;
    render(<SubscribeButton requirementId={1} currentUserId="u1" subscribers={[]} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('TS-15: muestra mensaje de error cuando la mutación falla con 403', () => {
    mockSubscribeMutate.mockImplementation(
      (userId: string, options: { onError?: (err: unknown) => void }) => {
        options.onError?.({ status: 403, message: 'Sin acceso al proyecto' });
      }
    );
    render(<SubscribeButton requirementId={1} currentUserId="u1" subscribers={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suscribirse' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Sin acceso al proyecto');
  });
});
