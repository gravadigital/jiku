import React, { useRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InlineCommentEditor, type InlineCommentEditorHandle } from './InlineCommentEditor';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder', () => ({
  AttachmentPlaceholder: ({
    attachmentId,
    fileName,
  }: {
    attachmentId: number;
    fileName?: string;
  }) => (
    <span data-testid={`attachment-placeholder-${attachmentId}`}>
      AP:{attachmentId}:{fileName ?? ''}
    </span>
  ),
}));

interface HarnessProps {
  readonly onChange?: (v: string) => void;
  readonly onReady: (handle: InlineCommentEditorHandle) => void;
}

function Harness({ onChange, onReady }: HarnessProps) {
  const ref = useRef<InlineCommentEditorHandle>(null);
  const setRef = (h: InlineCommentEditorHandle | null) => {
    ref.current = h;
    if (h) onReady(h);
  };
  return <InlineCommentEditor ref={setRef} onChange={onChange} ariaLabel="Comentario" />;
}

function renderEditor(onChange?: (v: string) => void): {
  handle: InlineCommentEditorHandle;
  editor: HTMLElement;
} {
  let captured: InlineCommentEditorHandle | null = null;
  render(
    <Harness
      onChange={onChange}
      onReady={(h) => {
        captured = h;
      }}
    />
  );
  if (!captured) throw new Error('Editor handle not captured');
  return {
    handle: captured,
    editor: screen.getByRole('textbox', { name: 'Comentario' }),
  };
}

describe('InlineCommentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza un contenedor contentEditable con el aria-label provisto', () => {
    const { editor } = renderEditor();
    expect(editor).toBeInTheDocument();
    expect(editor.getAttribute('contenteditable')).toBe('true');
  });

  it('arranca vacío: getValue() devuelve cadena vacía', () => {
    const { handle } = renderEditor();
    expect(handle.getValue()).toBe('');
  });

  it('getValue() devuelve el texto escrito por el usuario', () => {
    const onChange = vi.fn();
    const { handle, editor } = renderEditor(onChange);

    act(() => {
      editor.textContent = 'Hola mundo';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(handle.getValue()).toBe('Hola mundo');
    expect(onChange).toHaveBeenCalledWith('Hola mundo');
  });

  it('insertAttachment inserta un chip como AttachmentPlaceholder dentro del editor', () => {
    const { handle, editor } = renderEditor();
    act(() => {
      handle.insertAttachment(42, 'image', 'foto.png');
    });

    const chip = screen.getByTestId('attachment-placeholder-42');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('AP:42:foto.png');
    expect(editor.contains(chip)).toBe(true);
  });

  it('serializa imagen como ![attach:N] y archivo como [attach:N]', () => {
    const { handle } = renderEditor();

    act(() => {
      handle.insertAttachment(10, 'image');
      handle.insertAttachment(20, 'file');
    });

    const value = handle.getValue();
    expect(value).toContain('![attach:10]');
    expect(value).toContain('[attach:20]');
    expect(value).not.toContain('![attach:20]');
  });

  it('serialización mezcla texto + chips en el orden del DOM', () => {
    const { handle, editor } = renderEditor();

    act(() => {
      editor.textContent = 'Mirá ';
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      handle.insertAttachment(7, 'image');
    });
    act(() => {
      editor.appendChild(document.createTextNode(' qué te parece'));
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const value = handle.getValue();
    expect(value).toMatch(/^Mirá\s.*!\[attach:7\].*qué te parece$/);
  });

  it('clear() vacía el editor y desmonta los chips', () => {
    const { handle } = renderEditor();
    act(() => {
      handle.insertAttachment(99, 'file', 'doc.pdf');
    });
    expect(screen.getByTestId('attachment-placeholder-99')).toBeInTheDocument();

    act(() => {
      handle.clear();
    });

    expect(screen.queryByTestId('attachment-placeholder-99')).not.toBeInTheDocument();
    expect(handle.getValue()).toBe('');
  });

  it('remover el chip del DOM (p.ej. Backspace) actualiza la serialización', () => {
    const onChange = vi.fn();
    const { handle, editor } = renderEditor(onChange);

    act(() => {
      handle.insertAttachment(55, 'file');
    });
    expect(handle.getValue()).toContain('[attach:55]');

    const chipWrapper = editor.querySelector('[data-attachment-id="55"]');
    expect(chipWrapper).not.toBeNull();

    act(() => {
      chipWrapper!.remove();
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(handle.getValue()).not.toContain('[attach:55]');
    expect(screen.queryByTestId('attachment-placeholder-55')).not.toBeInTheDocument();
  });

  it('serializa <br> y saltos de línea como \\n', () => {
    const { handle, editor } = renderEditor();

    act(() => {
      editor.innerHTML = 'línea1<br>línea2';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(handle.getValue()).toBe('línea1\nlínea2');
  });
});
