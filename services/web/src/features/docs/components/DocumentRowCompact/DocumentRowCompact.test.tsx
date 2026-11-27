import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocumentRowCompact } from './DocumentRowCompact';
import type { DocsDocument } from '../../types/docs.types';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const ID_A = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const ID_B = '01J9Z3K8M2Q4R6T8V0W2Y4A6C9';
const DOC_A = {
  id: ID_A,
  title: 'Arquitectura de videoconferencia',
  path: '/clientes/exo/videoconferencia/arquitectura.md',
  folderId: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0',
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  topics: ['video', 'arquitectura'],
  projectMatch: 'direct',
  lock: {
    sessionId: 's',
    holder: 'sub-ana',
    holderName: 'Ana Gómez',
    via: 'human',
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
} as unknown as DocsDocument;
const DOC_B = {
  ...DOC_A,
  id: ID_B,
  title: 'Runbook de guardias',
  updatedAt: '2026-10-20T09:00:00.000Z',
  topics: [],
  projectMatch: 'indirect',
  lock: null,
} as DocsDocument;

const renderRow = (doc: DocsDocument, showIndirect?: boolean) =>
  render(
    <ul>
      <DocumentRowCompact doc={doc} showIndirect={showIndirect} />
    </ul>
  );

const scss = fs.readFileSync(path.resolve(__dirname, './DocumentRowCompact.module.scss'), 'utf8');

function extractBlock(source: string, selectorPattern: RegExp): string {
  const match = source.match(selectorPattern);
  if (!match || match.index === undefined) return '';
  const open = source.indexOf('{', match.index);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return '';
}

describe('DocumentRowCompact', () => {
  it('TS-8: título enlazado, fecha y temas; sin ruta ni "En edición"', () => {
    const { container } = renderRow(DOC_A, true);
    const item = screen.getByRole('listitem');
    expect(
      within(item).getByRole('link', { name: 'Arquitectura de videoconferencia' })
    ).toHaveAttribute('href', `/docs/${ID_A}`);
    expect(within(item).getByText('24/10/2026')).toBeInTheDocument();
    expect(within(item).getByText('video')).toBeInTheDocument();
    expect(within(item).getByText('arquitectura')).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).not.toContain('/clientes/exo/videoconferencia/');
    expect(text).not.toContain('arquitectura.md');
    expect(text).not.toContain('En edición');
    expect(text).not.toContain('Ana Gómez lo está editando');
    expect(text).not.toContain('vinculado, sin proyecto propio');
  });

  it('TS-9: sin temas ni fecha', () => {
    const { unmount } = renderRow({ ...DOC_A, topics: [], updatedAt: '' } as DocsDocument);
    expect(screen.getByText('Sin tema')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    unmount();
    renderRow({ ...DOC_A, topics: undefined } as DocsDocument);
    expect(screen.getByText('Sin tema')).toBeInTheDocument();
  });

  it('TS-10: marca indirecta solo con showIndirect', () => {
    const { container, unmount } = renderRow(DOC_B, true);
    expect(container.querySelector('li')?.textContent).toContain(
      'Sin tema · vinculado, sin proyecto propio'
    );
    unmount();

    const second = renderRow({ ...DOC_B, topics: ['infra'] } as DocsDocument, true);
    expect(screen.getByText('infra')).toBeInTheDocument();
    expect(second.container.textContent).toContain('· vinculado, sin proyecto propio');
    second.unmount();

    const third = renderRow(DOC_B);
    expect(screen.getByText('Sin tema')).toBeInTheDocument();
    expect(third.container.textContent).not.toContain('vinculado, sin proyecto propio');
  });

  it('TS-11: el CSS evita el desborde (columna de texto minmax(0, 1fr), min-width 0)', () => {
    expect(extractBlock(scss, /\.row\s*{/)).toMatch(
      /grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto\s*;/
    );
    expect(extractBlock(scss, /\.text\s*{/)).toMatch(/min-width:\s*0\s*;/);
    expect(extractBlock(scss, /\.link\s*{/)).toMatch(/overflow-wrap:\s*anywhere\s*;/);
    expect(scss).not.toMatch(/@media/);
  });
});
