import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Loader } from './Loader';

describe('Loader', () => {
  it('variant block anuncia con role="status" y muestra "Cargando…" por defecto (TS-34)', () => {
    render(<Loader />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Cargando…');
  });

  it('variant block acepta un label propio para la excepción nombrable (TS-35)', () => {
    render(<Loader label="Subiendo archivo…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Subiendo archivo…');
  });

  it('variant inline no muestra label visible pero expone aria-label="Cargando" (TS-36)', () => {
    render(<Loader variant="inline" />);

    const status = screen.getByRole('status', { name: 'Cargando' });
    expect(status).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
  });

  it('el indicador gráfico es decorativo (TS-37)', () => {
    const { container } = render(<Loader />);

    const spinner = container.querySelector('[aria-hidden="true"]');
    expect(spinner).not.toBeNull();
  });

  it('usa el diámetro md (24px) en block y sm (16px) en inline (TS-38)', () => {
    const { container: blockContainer } = render(<Loader />);
    const { container: inlineContainer } = render(<Loader variant="inline" />);

    expect(blockContainer.querySelector('[aria-hidden="true"]')?.className).toMatch(/md/);
    expect(inlineContainer.querySelector('[aria-hidden="true"]')?.className).toMatch(/sm/);
  });
});
