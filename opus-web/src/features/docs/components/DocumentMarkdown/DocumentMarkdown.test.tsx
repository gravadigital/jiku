import { render, screen } from '@testing-library/react';
import { DocumentMarkdown } from './DocumentMarkdown';

const ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const CONTENT = `---\nprojects: [12]\nvisibility: public\n---\n# Instalación\n\nPaso uno.\n\n![Diagrama](/docs/attachments/${ID})\n`;

describe('DocumentMarkdown', () => {
  it('TS-20: renderiza seguro, sin frontmatter, con h2 y adjunto por el proxy', () => {
    render(<DocumentMarkdown content={CONTENT} />);
    expect(screen.queryByText(/projects: \[12\]/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Instalación' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Diagrama' })).toHaveAttribute(
      'src',
      `/api/docs/attachments/${ID}`
    );
  });

  it('TS-21: enlaces en pestaña nueva, sin javascript: y con adjuntos reescritos', () => {
    render(
      <DocumentMarkdown
        content={`[Guía](https://example.com/g) [mal](javascript:alert(1)) [Adjunto](/docs/attachments/${ID})`}
      />
    );
    const guia = screen.getByRole('link', { name: 'Guía' });
    expect(guia).toHaveAttribute('href', 'https://example.com/g');
    expect(guia).toHaveAttribute('target', '_blank');
    expect(guia).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'mal' })).not.toBeInTheDocument();
    expect(screen.getByText('mal')).not.toHaveAttribute('href');
    expect(screen.getByRole('link', { name: 'Adjunto' })).toHaveAttribute(
      'href',
      `/api/docs/attachments/${ID}`
    );
  });

  it('TS-22: el HTML crudo no se ejecuta', () => {
    const { container } = render(
      <DocumentMarkdown content="Hola <script>window.__x=1</script><img src=x onerror=alert(1)>" />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect((window as unknown as { __x?: number }).__x).toBeUndefined();
  });
});
