import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('está oculto en reposo (TS-35)', () => {
    render(
      <Tooltip content="Fecha de alta">
        <button>Info</button>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('aparece con hover tras el delay (TS-36)', () => {
    render(
      <Tooltip content="Fecha de alta">
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('tooltip')).toHaveTextContent('Fecha de alta');
  });

  it('aparece con foco de teclado (TS-37)', () => {
    render(
      <Tooltip content="Fecha de alta">
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.focus(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('no aparece antes del delay (TS-38)', () => {
    render(
      <Tooltip content="Fecha de alta">
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('delay configurable (TS-39)', () => {
    render(
      <Tooltip content="Texto" delay={0}>
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('el disparador lo referencia con aria-describedby (TS-40)', () => {
    render(
      <Tooltip content="Texto" delay={0}>
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const tooltip = screen.getByRole('tooltip');

    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('Esc lo cierra sin mover el foco (TS-41)', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <Tooltip content="Texto" delay={0}>
        <button>Info</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    button.focus();
    fireEvent.mouseEnter(button);
    await screen.findByRole('tooltip');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('placement por defecto es top (TS-42)', () => {
    render(
      <Tooltip content="Texto" delay={0}>
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const tooltip = screen.getByRole('tooltip');

    expect(tooltip.className).toMatch(/_top_/);
  });

  it('placement explícito se aplica (TS-43)', () => {
    render(
      <Tooltip content="Texto" delay={0} placement="right">
        <button>Info</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const tooltip = screen.getByRole('tooltip');

    expect(tooltip.className).toMatch(/_right_/);
    expect(tooltip.className).not.toMatch(/_top_/);
  });

  it('el fondo dejó de ser el gris fuera de paleta (TS-44)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'Tooltip.module.scss'), 'utf-8');

    expect(source).not.toContain('#625F5F');
    expect(source).not.toContain('--color-tooltip-bg');
    expect(source).toContain('var(--tooltip-bg)');
  });
});
