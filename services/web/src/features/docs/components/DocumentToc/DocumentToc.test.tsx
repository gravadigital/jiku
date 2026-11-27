import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentToc } from './DocumentToc';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const HEADINGS = [
  { level: 1 as const, text: 'Contexto', id: 'contexto', line: 1 },
  { level: 2 as const, text: 'Decisiones', id: 'decisiones', line: 5 },
];

afterEach(() => vi.unstubAllGlobals());

describe('DocumentToc', () => {
  it('TS-21: nav con un enlace por encabezado; sin encabezados no se renderiza', () => {
    const { container, rerender } = render(<DocumentToc headings={HEADINGS} />);
    const nav = screen.getByRole('navigation', { name: 'En este documento' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contexto' })).toHaveAttribute('href', '#contexto');
    expect(screen.getByRole('link', { name: 'Decisiones' }).closest('li')?.className).toMatch(
      /nested/
    );
    rerender(<DocumentToc headings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('TS-22: marca con aria-current el encabezado visible', () => {
    let callback: IntersectionObserverCallback = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const target = document.createElement('h3');
    target.id = 'decisiones';
    document.body.appendChild(target);

    const { unmount } = render(<DocumentToc headings={HEADINGS} />);
    act(() => {
      callback(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(screen.getByRole('link', { name: 'Decisiones' })).toHaveAttribute(
      'aria-current',
      'location'
    );
    expect(screen.getByRole('link', { name: 'Contexto' })).not.toHaveAttribute('aria-current');
    unmount();
    expect(disconnect).toHaveBeenCalled();
    target.remove();
  });

  it('TS-22: sin IntersectionObserver no lanza', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => render(<DocumentToc headings={HEADINGS} />)).not.toThrow();
  });
});
