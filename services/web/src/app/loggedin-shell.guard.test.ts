import fs from 'node:fs';
import path from 'node:path';

// El handoff fija el alcance del producto en desktop con un ancho mínimo de 1400px: "por debajo,
// scroll horizontal; no hay diseño responsive móvil en este alcance".
//
// Lo que había era lo contrario: `overflow-x: hidden` en el área de contenido, que por debajo de
// ~900px RECORTABA el contenido en vez de dejar alcanzarlo (registrado en la arquitectura como
// limitación: "por debajo de ~900px el contenido queda con muy poco ancho").
const SHELL = fs.readFileSync(path.resolve(__dirname, '(loggedin)/styles.module.scss'), 'utf8');

describe('shell de (loggedin) — ancho mínimo del handoff', () => {
  it('el contenido declara el ancho mínimo de 1400px del alcance desktop', () => {
    expect(SHELL).toMatch(/min-width:\s*var\(--layout-app-min-width\)/);
  });

  it('el contenido scrollea en horizontal en vez de recortar', () => {
    // `overflow-x: hidden` era lo que hacía inalcanzable el contenido angosto.
    expect(SHELL).not.toMatch(/overflow-x:\s*hidden/);
  });

  it('el ancho minimo lo sostiene el contenedor, no el area de contenido', () => {
    // El min-width tiene que estar en `.layoutContainer` y NO en `.mainContainer`.
    //
    // Puesto en el area de contenido —que es un hijo flex— hacia que reclamara 1400px de los
    // 1440 del viewport y dejara 40px para el sidebar, que entonces recortaba a su propio
    // hijo de 300px: la barra aparecia como una tira de iconos. Acá el minimo lo sostiene la
    // fila entera y el sidebar conserva su ancho.
    expect(SHELL).toMatch(
      /\.layoutContainer\s*\{[^}]*min-width:\s*var\(--layout-app-min-width\)/s
    );
    expect(SHELL).not.toMatch(
      /\.mainContainer\s*\{[^}]*min-width:\s*var\(--layout-app-min-width\)/s
    );
  });
});
