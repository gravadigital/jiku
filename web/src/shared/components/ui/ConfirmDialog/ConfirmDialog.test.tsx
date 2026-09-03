import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const BASE_PROPS = {
  title: 'Eliminar requisito',
  body: 'Se va a eliminar el requisito #151. Esta acción no se puede deshacer.',
  confirmLabel: 'Eliminar',
};

describe('ConfirmDialog', () => {
  it('ambas acciones son secondary-dismiss — ninguna primaria (TS-46)', () => {
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    const confirmButton = screen.getByRole('button', { name: 'Eliminar' });
    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });

    expect(confirmButton.className).toMatch(/secondaryDismiss/);
    expect(cancelButton.className).toMatch(/secondaryDismiss/);
    expect(confirmButton.className).not.toMatch(/\bprimary\b/);
    expect(cancelButton.className).not.toMatch(/\bprimary\b/);
  });

  it('no hay rojo en la acción de confirmar (TS-47)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ConfirmDialog.module.scss'), 'utf-8');

    expect(source).not.toContain('--color-button-delete');
    expect(source).not.toContain('#FB033F');
  });

  it('el botón de confirmar usa el verbo, no "Sí" (TS-48)', () => {
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí' })).toBeNull();
  });

  it('el foco inicial va en cancelar (TS-49)', () => {
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('el cuerpo nombra la entidad y la irreversibilidad (TS-50)', () => {
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByText(/Se va a eliminar el requisito #151/)).toBeInTheDocument();
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument();
  });

  it('role="dialog" con aria-modal y aria-labelledby (TS-51)', () => {
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = screen.getByText('Eliminar requisito');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('Esc cierra cancelando (TS-52)', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open {...BASE_PROPS} onConfirm={onConfirm} onCancel={onCancel} />);

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('click en confirmar dispara onConfirm (TS-53)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={onConfirm} onCancel={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('click en cancelar dispara onCancel (TS-54)', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={onCancel} />
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('pending deshabilita las acciones y marca el confirmar en carga (TS-55)', () => {
    render(
      <ConfirmDialog open {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} pending />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    const [cancelButton, confirmButton] = buttons;

    expect(cancelButton).toHaveTextContent('Cancelar');
    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toHaveAttribute('aria-busy', 'true');
  });

  it('closed no renderiza (TS-56)', () => {
    render(
      <ConfirmDialog open={false} {...BASE_PROPS} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('el foco vuelve al elemento que lo abrió (TS-57)', async () => {
    const user = userEvent.setup();
    function Wrapper() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <ConfirmDialog
            open={open}
            {...BASE_PROPS}
            onConfirm={vi.fn()}
            onCancel={() => setOpen(false)}
          />
        </div>
      );
    }
    render(<Wrapper />);

    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);

    const cancelButton = await screen.findByRole('button', { name: 'Cancelar' });
    await user.click(cancelButton);

    expect(document.activeElement).toBe(opener);
  });

  it('el SCSS dejó los tokens del sistema anterior (TS-58)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ConfirmDialog.module.scss'), 'utf-8');

    expect(source).not.toContain('--radius-cards');
    expect(source).not.toContain('--color-general-title');
    expect(source).not.toContain('--color-general-text');
    expect(source).not.toContain('--z-index-modal');
    expect(source).toContain('var(--radius-surface)');
    expect(source).toContain('var(--elevation-raised)');
  });
});
