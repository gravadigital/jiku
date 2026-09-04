import fs from 'node:fs';
import path from 'node:path';

// Especificación de la card según el handoff (README § Cards y designs/Jiku App.dc.html).
//
// La estructura del código ya coincide (título, fila estado+responsable, horas, pie de tres
// datos). Lo que falta es el tratamiento VISUAL del pie y del vencimiento:
//
//   pie normal:  grid de 3 columnas, centrado, fondo --row-alt, borde superior 1px,
//                label 9px UPPERCASE --text3, dato 12px/600
//   pie vencido: fondo #F72C25 PLENO con texto blanco, labels 9/600, datos 12/700
//   card vencida: borde 1.5px rojo y SIN sombra
//
// El código tenía el pie como fila flex y el vencimiento como un simple cambio de color de
// texto, sin relleno.
const MODULE = fs.readFileSync(path.resolve(__dirname, './Card.module.scss'), 'utf8');
const COMPONENT_TIER = fs.readFileSync(
  path.resolve(__dirname, '../../../../styles/_component.scss'),
  'utf8'
);

const block = (source: string, selector: string): string => {
  const start = source.indexOf(selector);
  if (start === -1) return '';
  const from = source.indexOf('{', start);
  let depth = 0;
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(from, i + 1);
    }
  }
  return '';
};

describe('Card — pie de métricas de la card de tarea', () => {
  const footer = block(MODULE, '.footer {');

  it('es una grilla de tres columnas iguales', () => {
    expect(footer).toMatch(/display:\s*grid/);
    expect(footer).toMatch(/grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  });

  it('centra sus tres datos', () => {
    expect(footer).toMatch(/text-align:\s*center/);
  });

  it('se apoya en el fondo hundido con un borde superior', () => {
    expect(footer).toMatch(/background-color:\s*var\(--card-footer-bg\)/);
    expect(footer).toMatch(/border-top:\s*1px solid var\(--card-border\)/);
  });

  it('queda pegado al fondo de la card', () => {
    // Con `margin-top: auto` el pie se alinea abajo aunque las cards de una fila tengan
    // distinto alto de contenido, que es lo que el prototipo muestra.
    expect(footer).toMatch(/margin-top:\s*auto/);
  });
});

describe('Card — vencimiento: el único uso de rojo pleno del sistema', () => {
  it('el pie vencido se rellena de rojo pleno, no sólo cambia el color del texto', () => {
    const overdue = block(MODULE, '.taskOverdue .footer');
    expect(overdue).toMatch(/background-color:\s*var\(--card-footer-overdue-bg\)/);
    expect(overdue).toMatch(/color:\s*var\(--card-footer-overdue-text\)/);
  });

  it('--card-footer-overdue-bg es el pleno urgente (rojo), no su tinte', () => {
    expect(COMPONENT_TIER).toMatch(/--card-footer-overdue-bg:\s*var\(--state-urgent-full\)/);
  });

  it('la card vencida lleva borde de 1.5px y pierde la sombra', () => {
    const card = block(MODULE, '.taskOverdue {');
    expect(card).toMatch(/border:\s*1\.5px solid var\(--state-urgent-full\)/);
    expect(card).toMatch(/box-shadow:\s*none/);
  });
});

describe('Card — hover de card clicable', () => {
  it('el hover marca el borde en verde agua, no sólo eleva la sombra', () => {
    // Regla de Interactions del handoff: "card clicable → border-color → #61CCB9".
    const hover = block(MODULE, '.card:has(.titleLink)');
    expect(hover).toMatch(/border-color:\s*var\(--border-action\)/);
  });
});
