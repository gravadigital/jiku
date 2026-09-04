import fs from 'node:fs';
import path from 'node:path';

// El handoff distingue la superficie del sidebar de la de las cards: en claro las dos son
// claras (#F6F6F9 el sidebar, blanco la card), pero en oscuro el sidebar es MÁS oscuro que el
// canvas (#0B1319 contra #0E121A) mientras la card es más clara (#1B202C). Con --bg-surface el
// sidebar quedaba del color de una card, que es justo la relación invertida.
const MODULE = fs.readFileSync(path.resolve(__dirname, './SidebarNav.module.scss'), 'utf8');
const COMPONENT_TIER = fs.readFileSync(
  path.resolve(__dirname, '../../../../styles/_component.scss'),
  'utf8'
);

describe('SidebarNav — superficie propia del sidebar', () => {
  it('el fondo del sidebar sale de --nav-bg, no de --bg-surface', () => {
    expect(MODULE).toMatch(/\.sidebar\s*\{[\s\S]*?background-color:\s*var\(--nav-bg\)/);
  });

  it('--nav-bg está declarado en el tier de componente sobre el semántico del sidebar', () => {
    expect(COMPONENT_TIER).toMatch(/--nav-bg:\s*var\(--surface-sidebar\)/);
  });
});
