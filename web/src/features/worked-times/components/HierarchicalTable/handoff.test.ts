import fs from 'node:fs';
import path from 'node:path';

// El handoff (pantalla 7) especifica la barra de proporción con fondo `--accent-soft` y radio 8.
//
// El código la tenía en --state-in-progress-tint, que es un color de ESTADO ("en curso"). La
// barra no informa un estado: informa una proporción. Usar un tinte de estado ahí le da un
// significado que no tiene — y el propio handoff dice que el verde agua "no se usa como color
// de estado", de modo que la relación es la inversa: esto es acento, no estado.
const MODULE = fs.readFileSync(path.resolve(__dirname, './HierarchicalTable.module.scss'), 'utf8');
const SEMANTIC = fs.readFileSync(
  path.resolve(__dirname, '../../../../styles/_semantic.scss'),
  'utf8'
);

describe('HierarchicalTable — barra de proporción', () => {
  it('se apoya en el acento suave, no en un tinte de estado', () => {
    expect(MODULE).toMatch(/\.barBg\s*\{[^}]*background:\s*var\(--bg-accent-soft\)/s);
    expect(MODULE).not.toMatch(/\.barBg\s*\{[^}]*--state-in-progress-tint/s);
  });

  it('conserva el radio de 8px del handoff', () => {
    expect(MODULE).toMatch(/\.barBg\s*\{[^}]*border-radius:\s*var\(--radius-action\)/s);
  });
});

// --accent-soft del handoff es un token PROPIO, no el --bg-active-subtle que ya existía: ese
// está al 8% y lo consumen doce hovers y skeletons donde ser apenas perceptible es el punto.
// Subirlo al 14% para la barra habría oscurecido todos esos estados de paso.
describe('--bg-accent-soft es el acento suave del handoff', () => {
  it('en modo claro es el verde agua al 14%', () => {
    expect(SEMANTIC).toMatch(/--bg-accent-soft:\s*rgba\(97,\s*204,\s*185,\s*\.14\)/);
  });

  it('en modo oscuro sube al 16%, como fija el handoff', () => {
    const darkBlock = /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(SEMANTIC)?.[1] ?? '';
    expect(darkBlock).toMatch(/--bg-accent-soft:\s*rgba\(97,\s*204,\s*185,\s*\.16\)/);
  });

  it('--bg-active-subtle sigue al 8%: es otro rol y no se toca', () => {
    expect(SEMANTIC).toMatch(/--bg-active-subtle:\s*rgba\(97,\s*204,\s*185,\s*\.08\)/);
  });
});

describe('el subítem activo del sidebar usa el acento suave', () => {
  const COMPONENT = fs.readFileSync(
    path.resolve(__dirname, '../../../../styles/_component.scss'),
    'utf8'
  );

  it('--nav-subitem-active-bg resuelve al acento suave del handoff', () => {
    // Handoff § Sidebar: "Subítem activo: fondo --accent-soft".
    expect(COMPONENT).toMatch(/--nav-subitem-active-bg:\s*var\(--bg-accent-soft\)/);
  });
});
