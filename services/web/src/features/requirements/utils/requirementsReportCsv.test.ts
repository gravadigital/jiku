import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildRequirementsReportCsv, downloadCsv } from './requirementsReportCsv';
import type { RequirementReportItem } from '../types/requirement.types';

const items: RequirementReportItem[] = [
  {
    id: 1,
    title: 'Req A',
    type: 'incidencia',
    state: 'resuelto',
    createdBy: '298372847362847',
    creator: { id: '298372847362847', name: 'Iván Pérez', email: 'ivan@grava.io' },
    createdAt: '2026-06-01T00:00:00Z',
    inProgressAt: '2026-06-02T00:00:00Z',
    finishedAt: '2026-06-05T00:00:00Z',
    totalMinutes: 90,
    resolutionType: 'error_interno',
    resolutionConclusion: 'El equipo confirmó el bug en el endpoint',
    resolutionComment: 'El cliente confirmó el error',
    project: { id: 1, name: 'Proyecto Alpha' },
  },
  {
    id: 2,
    title: 'Req B',
    type: 'funcionalidad',
    state: 'analisis',
    createdBy: '110298347298347',
    creator: { id: '110298347298347', name: 'Ana Gómez', email: 'ana@grava.io' },
    createdAt: '2026-05-01T00:00:00Z',
    inProgressAt: null,
    finishedAt: null,
    totalMinutes: 0,
    resolutionType: null,
    resolutionConclusion: null,
    resolutionComment: null,
    project: null,
  },
];

describe('buildRequirementsReportCsv', () => {
  it('TS-6/TS-18: genera CSV con BOM UTF-8, headers, tipo de resolución humanizado y conclusión en texto libre', () => {
    const csv = buildRequirementsReportCsv(items);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const withoutBom = csv.slice(1);
    const lines = withoutBom.split('\n');

    expect(lines[0]).toBe(
      'ID,Tipo,Título,Proyecto,Creado por,Fecha creación,Fecha inicio,Fecha resolución,Horas,Tipo de resolución,Conclusión,Comentario de resolución'
    );
    expect(lines[1]).toContain('1');
    expect(lines[1]).toContain('Req A');
    expect(lines[1]).toContain('Proyecto Alpha');
    expect(lines[1]).toContain('1h 30m');
    expect(lines[1]).toContain('Error interno');
    expect(lines[1]).toContain('El equipo confirmó el bug en el endpoint');
    expect(lines[2]).toContain('2');
    expect(lines[2]).toContain('Req B');
    expect(lines[2]).toContain('0h 0m');
  });

  it('la columna "Creado por" lleva el nombre del autor, no su id', () => {
    const csv = buildRequirementsReportCsv(items);
    const lines = csv.slice(1).split('\n');

    expect(lines[1]).toContain('Iván Pérez');
    expect(lines[1]).not.toContain('298372847362847');
    expect(lines[2]).toContain('Ana Gómez');
  });

  it('la columna "Creado por" cae al guion cuando la api no manda el autor', () => {
    const csv = buildRequirementsReportCsv([{ ...items[0], creator: null }]);

    expect(csv).not.toContain('298372847362847');
    expect(csv.slice(1).split('\n')[1].split(',')[4]).toBe('-');
  });

  it('escapa valores con comas envolviéndolos en comillas dobles', () => {
    const csv = buildRequirementsReportCsv([{ ...items[0], title: 'Título, con coma' }]);

    expect(csv).toContain('"Título, con coma"');
  });

  it('escapa comillas dobles duplicándolas', () => {
    const csv = buildRequirementsReportCsv([
      { ...items[0], resolutionComment: 'Dijo "listo" el cliente' },
    ]);

    expect(csv).toContain('"Dijo ""listo"" el cliente"');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('crea un Blob, un link de descarga con el nombre correcto, y revoca la URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    downloadCsv('contenido,csv', 'reporte-requisitos.csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv;charset=utf-8');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
