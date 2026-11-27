import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Accordion } from './Accordion';

describe('Accordion', () => {
  it('arranca plegado por defecto (TS-23)', () => {
    render(
      <Accordion title="Alcance">
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Contenido')).not.toBeVisible();
  });

  it('defaultExpanded lo abre (TS-24)', () => {
    render(
      <Accordion title="Alcance" defaultExpanded>
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Contenido')).toBeVisible();
  });

  it('click alterna y avisa con onToggle (TS-25)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <Accordion title="Alcance" onToggle={onToggle}>
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('el segundo click cierra (TS-26)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <Accordion title="Alcance" onToggle={onToggle}>
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    await user.click(header);
    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(onToggle).toHaveBeenNthCalledWith(1, true);
    expect(onToggle).toHaveBeenNthCalledWith(2, false);
  });

  it('Enter alterna (TS-27)', async () => {
    const user = userEvent.setup();
    render(
      <Accordion title="Alcance">
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    header.focus();
    await user.keyboard('{Enter}');

    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('Space alterna (TS-28)', async () => {
    const user = userEvent.setup();
    render(
      <Accordion title="Alcance">
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    header.focus();
    await user.keyboard(' ');

    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('aria-controls apunta al panel y el panel a la cabecera (TS-29)', () => {
    render(
      <Accordion title="Alcance" defaultExpanded>
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    const region = screen.getByRole('region');

    expect(header.getAttribute('aria-controls')).toBe(region.id);
    expect(region.getAttribute('aria-labelledby')).toBe(header.id);
  });

  it('el estado pending se anuncia en texto (TS-30)', () => {
    render(
      <Accordion title="Alcance" status="pending">
        <p>Contenido</p>
      </Accordion>
    );

    expect(screen.getByText('Alcance, pendiente')).toBeInTheDocument();
    const mark = screen.getByText('!');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  it('el estado done se anuncia en texto (TS-31)', () => {
    render(
      <Accordion title="Cierre estimado" status="done">
        <p>Contenido</p>
      </Accordion>
    );

    expect(screen.getByText('Cierre estimado, completo')).toBeInTheDocument();
    const mark = screen.getByText('✓');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  it('la marca distingue por glifo además de por color (TS-32)', () => {
    const { rerender } = render(
      <Accordion title="Alcance" status="pending">
        <p>Contenido</p>
      </Accordion>
    );
    expect(screen.getByText('!')).toBeInTheDocument();

    rerender(
      <Accordion title="Alcance" status="done">
        <p>Contenido</p>
      </Accordion>
    );
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('el contenido plegado sale del orden de foco (TS-33)', () => {
    render(
      <Accordion title="Alcance">
        <button>Interno</button>
      </Accordion>
    );

    const region = screen.getByRole('region', { hidden: true });
    expect(region).toHaveAttribute('hidden');
    expect(screen.queryByRole('button', { name: 'Interno' })).not.toBeInTheDocument();
  });

  it('la cabecera es un button dentro de un heading (TS-34)', () => {
    render(
      <Accordion title="Alcance">
        <p>Contenido</p>
      </Accordion>
    );

    const header = screen.getByRole('button', { name: /Alcance/ });
    expect(header.closest('h1,h2,h3,h4,h5,h6')).not.toBeNull();
  });

  // S-058: title acepta ReactNode para consumidores de fila de datos (ícono + texto + cifra)
  it('S-058: title acepta ReactNode (ícono + texto), el botón real sigue siendo el header', () => {
    render(
      <Accordion
        title={
          <>
            <img alt="Requisito" src="req.svg" />
            <span>Login SSO</span>
            <span>2h 30m</span>
          </>
        }
      >
        <p>Contenido</p>
      </Accordion>
    );

    expect(screen.getByRole('img', { name: 'Requisito' })).toBeInTheDocument();
    expect(screen.getByText('Login SSO')).toBeInTheDocument();
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
    expect(screen.getByText('Login SSO').closest('button')).not.toBeNull();
  });

  // S-058: showStatus=false omite la marca de completitud y su eco accesible
  it('S-058: showStatus=false no renderiza la marca de completitud ni su eco', () => {
    render(
      <Accordion title="Fila de datos" showStatus={false}>
        <p>Contenido</p>
      </Accordion>
    );

    expect(screen.queryByText('!')).not.toBeInTheDocument();
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('Fila de datos, pendiente')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fila de datos' })).toBeInTheDocument();
  });
});
