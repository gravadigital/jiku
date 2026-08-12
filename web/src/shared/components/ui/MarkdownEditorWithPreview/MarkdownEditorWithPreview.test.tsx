import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MarkdownEditorWithPreview } from './MarkdownEditorWithPreview';

vi.mock('@/features/attachments/components/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}));

describe('MarkdownEditorWithPreview', () => {
  it('inicia en modo Editar por defecto cuando no se pasa initialMode (S-086, CA-4)', () => {
    render(
      <MarkdownEditorWithPreview
        value="texto ya guardado"
        onChange={vi.fn()}
        placeholder="Placeholder..."
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue('texto ya guardado');
    expect(screen.getByText('Editar')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Vista previa')).toHaveAttribute('aria-pressed', 'false');
  });

  it('inicia en modo Vista previa cuando initialMode="preview" (S-086, CA-4 ajustado)', () => {
    render(
      <MarkdownEditorWithPreview
        value="texto ya guardado"
        onChange={vi.fn()}
        placeholder="Placeholder..."
        initialMode="preview"
      />
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Vista previa')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Editar')).toHaveAttribute('aria-pressed', 'false');
  });

  it('inicia en modo Editar cuando initialMode="edit" explícito (S-086, CA-4 ajustado)', () => {
    render(
      <MarkdownEditorWithPreview
        value=""
        onChange={vi.fn()}
        placeholder="Placeholder..."
        initialMode="edit"
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('alterna a Vista previa y renderiza el markdown (S-086, TS-1)', () => {
    render(
      <MarkdownEditorWithPreview
        value={'## Objetivo\n\nMejorar el flujo'}
        onChange={vi.fn()}
        placeholder="Placeholder..."
      />
    );

    fireEvent.click(screen.getByText('Vista previa'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('markdown-viewer')).toHaveTextContent('## Objetivo Mejorar el flujo');
    expect(screen.getByText('Vista previa')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Editar')).toHaveAttribute('aria-pressed', 'false');
  });

  it('vuelve a Editar sin perder el texto (S-086, TS-2, CA-2)', () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorWithPreview
        value={'## Objetivo\n\nMejorar el flujo'}
        onChange={onChange}
        placeholder="Placeholder..."
      />
    );

    fireEvent.click(screen.getByText('Vista previa'));
    fireEvent.click(screen.getByText('Editar'));

    expect(screen.getByRole('textbox')).toHaveValue('## Objetivo\n\nMejorar el flujo');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('muestra el placeholder en Vista previa cuando el valor está vacío (S-086, TS-3/4/5, CA-3)', () => {
    render(
      <MarkdownEditorWithPreview
        value=""
        onChange={vi.fn()}
        placeholder="Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta..."
      />
    );

    fireEvent.click(screen.getByText('Vista previa'));

    expect(
      screen.getByText('Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta...')
    ).toBeInTheDocument();
  });

  it('alternar el modo nunca invoca onChange (S-086, TS-9)', () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorWithPreview value="algo" onChange={onChange} placeholder="Placeholder..." />
    );

    fireEvent.click(screen.getByText('Vista previa'));
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(screen.getByText('Vista previa'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('escribir en el textarea invoca onChange con el nuevo valor (S-086)', () => {
    const onChange = vi.fn();
    render(<MarkdownEditorWithPreview value="" onChange={onChange} placeholder="Placeholder..." />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'nuevo texto' } });

    expect(onChange).toHaveBeenCalledWith('nuevo texto');
  });

  it('respeta disabled en el textarea (S-086)', () => {
    render(
      <MarkdownEditorWithPreview
        value="algo"
        onChange={vi.fn()}
        placeholder="Placeholder..."
        disabled
      />
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('acepta aria-label para el textarea (S-086)', () => {
    render(
      <MarkdownEditorWithPreview
        value="algo"
        onChange={vi.fn()}
        placeholder="Placeholder..."
        ariaLabel="Alcance"
      />
    );

    expect(screen.getByLabelText('Alcance')).toBeInTheDocument();
  });

  it('el contenedor de Vista previa tiene scroll horizontal propio para contenido ancho (S-086, TS-12)', () => {
    render(
      <MarkdownEditorWithPreview
        value="| Col largo 1 | Col largo 2 | Col largo 3 |"
        onChange={vi.fn()}
        placeholder="Placeholder..."
      />
    );

    fireEvent.click(screen.getByText('Vista previa'));

    expect(screen.getByTestId('markdown-viewer').parentElement?.className).toMatch(/preview/);
  });
});
