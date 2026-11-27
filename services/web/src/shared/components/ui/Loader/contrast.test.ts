import fs from 'node:fs';
import path from 'node:path';

// El spinner del Loader tomaba su color de `--loader-color`, fijo en el verde agua del acento.
// Dentro de un botón relleno de ESE MISMO verde agua el contraste era de 1.00:1: al enviar el
// formulario de login el texto desaparecía y no se veía nada en su lugar.
//
// La garantía es doble y por eso son dos archivos: el spinner hereda el color del contexto, y
// el botón le impone el suyo.
const LOADER = fs.readFileSync(path.resolve(__dirname, './Loader.module.scss'), 'utf8');
const BUTTON = fs.readFileSync(
  path.resolve(__dirname, '../Button/Button.module.scss'),
  'utf8'
);

const relativeLuminance = (hex: string): number => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('Loader — el spinner toma el color del contexto', () => {
  it('el borde del spinner es currentColor, no un token fijo', () => {
    expect(LOADER).toMatch(/\.spinner\s*\{[^}]*border:\s*2px solid currentColor/s);
    expect(LOADER).not.toMatch(/\.spinner\s*\{[^}]*border:\s*2px solid var\(--loader-color\)/s);
  });

  it('el Loader suelto sigue en el acento: lo fija su propia raíz', () => {
    // Sin esto, un Loader sobre una superficie heredaría el color de texto del contenedor en
    // vez del acento que declara el spec.
    expect(LOADER).toMatch(/\.loader\s*\{[^}]*color:\s*var\(--loader-color\)/s);
  });

  it('con motion reducido el anillo se completa sin perder el color heredado', () => {
    expect(LOADER).toMatch(/border-top-color:\s*currentColor/);
  });
});

describe('Button — el Loader del estado loading hereda el color del botón', () => {
  it('el botón le impone su color de texto al Loader', () => {
    // Por prefijo de atributo y no por `.loader`: esa clase la declara el módulo de Loader, así
    // que en el DOM está hasheada con SU hash — un `.loader` escrito en Button nunca matchearía.
    expect(BUTTON).toMatch(/\.button\s+:global\(\[class\*=['"]Loader-module['"]\]\)\s*\{[^}]*color:\s*inherit/s);
  });
});

describe('el contraste del spinner dentro de un botón relleno', () => {
  const AQUA = '#61CCB9'; // --bg-action-primary: fondo de primary / session / fab
  const DEEP = '#0B1934'; // --text-on-action: el color de texto que esos botones ya usan

  it('el spinner sobre el acento alcanza AA', () => {
    expect(contrastRatio(DEEP, AQUA)).toBeGreaterThanOrEqual(4.5);
  });

  it('y el caso roto —acento sobre acento— era literalmente invisible', () => {
    // Deja constancia del defecto que este arreglo cierra.
    expect(contrastRatio(AQUA, AQUA)).toBe(1);
  });
});
