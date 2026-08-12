import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/shared/components/ui/Modal';
import { vi } from 'vitest';

describe('Modal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza cuando isOpen es false', () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose}>
        <div>Contenido</div>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza cuando isOpen es true', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Contenido</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renderiza el titulo cuando se proporciona', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Mi Modal">
        <div>Contenido</div>
      </Modal>
    );

    expect(screen.getByText('Mi Modal')).toBeInTheDocument();
  });

  it('renderiza los children correctamente', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Contenido del modal</div>
      </Modal>
    );

    expect(screen.getByText('Contenido del modal')).toBeInTheDocument();
  });

  it('renderiza el footer cuando se proporciona', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} footer={<button>Accion</button>}>
        <div>Contenido</div>
      </Modal>
    );

    expect(screen.getByRole('button', { name: 'Accion' })).toBeInTheDocument();
  });

  it('llama onClose al hacer click en el boton cerrar', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Contenido</div>
      </Modal>
    );

    const closeButton = screen.getByRole('button', { name: /cerrar/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('llama onClose al presionar Escape', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Contenido</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('llama onClose al hacer click en el overlay', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Contenido</div>
      </Modal>
    );

    const overlay = screen.getByRole('dialog');
    await user.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('no llama onClose al hacer click en el contenido del modal', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div data-testid="modal-content">Contenido</div>
      </Modal>
    );

    const content = screen.getByTestId('modal-content');
    await user.click(content);

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
