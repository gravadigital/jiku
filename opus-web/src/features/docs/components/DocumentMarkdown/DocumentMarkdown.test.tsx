import { render, screen } from '@testing-library/react';
import { DocumentMarkdown } from './DocumentMarkdown';

const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const CONTENT = `---\nprojects: [12]\nvisibility: public\n---\n# Instalación\n\nPaso uno.\n\n![Diagrama](/docs/attachments/${ID})\n`;

describe('DocumentMarkdown', () => {
  it('TS-20: renderiza seguro, sin frontmatter, con h2 y adjunto por el proxy', () => {
    render(<DocumentMarkdown documentId={DOC_ID} content={CONTENT} />);
    expect(screen.queryByText(/projects: \[12\]/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Instalación' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Diagrama' })).toHaveAttribute(
      'src',
      `/api/docs/documents/${DOC_ID}/attachments/${ID}`
    );
  });

  it('TS-21: enlaces en pestaña nueva, sin javascript: y con adjuntos reescritos', () => {
    render(
      <DocumentMarkdown
        documentId={DOC_ID}
        content={`[Guía](https://example.com/g) [mal](javascript:alert(1)) [Adjunto](/docs/attachments/${ID})`}
      />
    );
    const guia = screen.getByRole('link', { name: 'Guía' });
    expect(guia).toHaveAttribute('href', 'https://example.com/g');
    expect(guia).toHaveAttribute('target', '_blank');
    expect(guia).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'mal' })).not.toBeInTheDocument();
    expect(screen.getByText(/mal/).closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'Adjunto' })).toHaveAttribute(
      'href',
      `/api/docs/documents/${DOC_ID}/attachments/${ID}`
    );
  });

  it('TS-22: el HTML crudo no se ejecuta', () => {
    const { container } = render(
      <DocumentMarkdown
        documentId={DOC_ID}
        content="Hola <script>window.__x=1</script><img src=x onerror=alert(1)>"
      />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect((window as unknown as { __x?: number }).__x).toBeUndefined();
  });
});

describe('S-090 — enlaces como texto', () => {
  const OTHER = '01JC7Z6C3M9E5G7H1J2K4N6P8Q';
  const DEST = `/api/docs/documents/${DOC_ID}/attachments/${ID}`;

  it('TS-8: enlace absoluto a otro documento se ve como texto', () => {
    const { container } = render(
      <DocumentMarkdown
        documentId={DOC_ID}
        content={`Ver [Guía de instalación](http://localhost:3000/docs/${OTHER}) para más.`}
      />
    );
    expect(screen.getByText(/Guía de instalación/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[href*="localhost:3000"]')).toBeNull();
  });

  it('TS-9: enlace relativo con ancla se ve como texto', () => {
    const { container } = render(
      <DocumentMarkdown documentId={DOC_ID} content={`Ver [la sección](/docs/${OTHER}#seccion).`} />
    );
    expect(screen.getByText(/la sección/)).toBeInTheDocument();
    expect(container.querySelector('a')).toBeNull();
  });

  it('TS-10: adjunto, https y mailto siguen siendo enlaces', () => {
    render(
      <DocumentMarkdown
        documentId={DOC_ID}
        content={`[Adjunto](/docs/attachments/${ID}) [Ejemplo](https://ejemplo.com) [Escribinos](mailto:soporte@acme.io)`}
      />
    );
    const adjunto = screen.getByRole('link', { name: 'Adjunto' });
    const ejemplo = screen.getByRole('link', { name: 'Ejemplo' });
    const escribinos = screen.getByRole('link', { name: 'Escribinos' });
    expect(adjunto).toHaveAttribute('href', DEST);
    expect(ejemplo).toHaveAttribute('href', 'https://ejemplo.com');
    expect(escribinos).toHaveAttribute('href', 'mailto:soporte@acme.io');
    for (const link of [adjunto, ejemplo, escribinos]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('TS-11: todo enlace vaciado por el filtro también es texto', () => {
    const { container } = render(
      <DocumentMarkdown
        documentId={DOC_ID}
        content="[mal](javascript:alert(1)) [data](data:text/html;base64,PHNjcmlwdD4=) [proto](//evil.com/x)"
      />
    );
    expect(screen.getByText(/mal/)).toBeInTheDocument();
    expect(screen.getByText(/data/)).toBeInTheDocument();
    expect(screen.getByText(/proto/)).toBeInTheDocument();
    expect(container.querySelector('a')).toBeNull();
  });

  it('TS-12: documento mixto, solo el enlace a documento pierde el <a>', () => {
    render(
      <DocumentMarkdown
        documentId={DOC_ID}
        content={`[Otro doc](/docs/${OTHER}) y [Guía](https://example.com/g)`}
      />
    );
    expect(screen.getByText(/Otro doc/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Otro doc' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Guía' })).toHaveAttribute(
      'href',
      'https://example.com/g'
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
