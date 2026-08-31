import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RichTextEditor, type AttachmentMeta } from './RichTextEditor';

vi.mock('@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder', () => ({
  AttachmentPlaceholder: ({ fileName }: { readonly fileName: string }) => (
    <div data-testid="attachment-placeholder">{fileName}</div>
  ),
}));

vi.mock('../AttachmentPreview/AttachmentPreview', () => ({
  AttachmentPreview: ({ fileName }: { readonly fileName: string }) => (
    <div data-testid="attachment-preview">{fileName}</div>
  ),
}));

vi.mock('../AttachmentSkeleton/AttachmentSkeleton', () => ({
  AttachmentSkeleton: () => <div data-testid="attachment-skeleton" />,
}));

const META: AttachmentMeta[] = [
  { id: 7, resource: 'file', fileName: 'informe.pdf', mimeType: 'application/pdf' },
];

/**
 * jsdom no hace layout: todo elemento mide 0. Estos tests dependen de la
 * posición vertical de cada textarea, así que se la fijamos a mano.
 */
function stubVerticalLayout(rects: ReadonlyArray<{ top: number; bottom: number }>) {
  const textareas = screen.getAllByRole('textbox');
  textareas.forEach((el, i) => {
    const rect = rects[i];
    if (!rect) return;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: rect.top,
      bottom: rect.bottom,
      left: 0,
      right: 100,
      width: 100,
      height: rect.bottom - rect.top,
      x: 0,
      y: rect.top,
      toJSON: () => ({}),
    } as DOMRect);
  });
  return textareas;
}

describe('RichTextEditor', () => {
  it('un click en el área vacía debajo del contenido enfoca el último textarea', () => {
    const { container } = render(
      <RichTextEditor value={'uno![file:7]dos'} onChange={vi.fn()} attachmentMeta={META} />
    );

    const textareas = stubVerticalLayout([
      { top: 0, bottom: 20 },
      { top: 40, bottom: 60 },
    ]);
    const last = textareas[textareas.length - 1] as HTMLTextAreaElement;

    fireEvent.mouseDown(container.firstChild as HTMLElement, { clientY: 500 });

    expect(last).toHaveFocus();
    expect(last.selectionStart).toBe(last.value.length);
  });

  it('un click en el hueco entre dos segmentos enfoca el textarea más cercano', () => {
    const { container } = render(
      <RichTextEditor value={'uno![file:7]dos'} onChange={vi.fn()} attachmentMeta={META} />
    );

    const textareas = stubVerticalLayout([
      { top: 0, bottom: 20 },
      { top: 100, bottom: 120 },
    ]);

    // Un punto más cerca del primer textarea (a 5px) que del segundo (a 75px).
    fireEvent.mouseDown(container.firstChild as HTMLElement, { clientY: 25 });

    expect(textareas[0]).toHaveFocus();
  });

  it('el cursor va al final del contenido del textarea enfocado', () => {
    const { container } = render(
      <RichTextEditor value={'uno![file:7]dos'} onChange={vi.fn()} attachmentMeta={META} />
    );

    const textareas = stubVerticalLayout([
      { top: 0, bottom: 20 },
      { top: 100, bottom: 120 },
    ]);
    const first = textareas[0] as HTMLTextAreaElement;

    fireEvent.mouseDown(container.firstChild as HTMLElement, { clientY: 25 });

    expect(first).toHaveFocus();
    expect(first.selectionStart).toBe(first.value.length);
    expect(first.selectionEnd).toBe(first.value.length);
  });

  it('un click sobre el propio textarea no interfiere con el cursor nativo', () => {
    render(<RichTextEditor value={'hola mundo'} onChange={vi.fn()} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(2, 2);

    fireEvent.mouseDown(textarea, { clientY: 10 });

    // El handler del contenedor no debe reposicionar el cursor que puso el navegador.
    expect(textarea.selectionStart).toBe(2);
  });

  it('no enfoca nada cuando el editor está deshabilitado', () => {
    const { container } = render(<RichTextEditor value={'hola'} onChange={vi.fn()} disabled />);

    stubVerticalLayout([{ top: 0, bottom: 20 }]);
    const textarea = screen.getByRole('textbox');

    fireEvent.mouseDown(container.firstChild as HTMLElement, { clientY: 500 });

    expect(textarea).not.toHaveFocus();
  });

  it('un click sobre un adjunto no roba el foco al textarea', () => {
    const { container } = render(
      <RichTextEditor value={'uno![file:7]dos'} onChange={vi.fn()} attachmentMeta={META} />
    );

    stubVerticalLayout([
      { top: 0, bottom: 20 },
      { top: 100, bottom: 120 },
    ]);
    const attachment = screen.getByTestId('attachment-placeholder');

    fireEvent.mouseDown(attachment, { clientY: 60 });

    screen.getAllByRole('textbox').forEach((el) => expect(el).not.toHaveFocus());
    expect(container).toBeInTheDocument();
  });
});
