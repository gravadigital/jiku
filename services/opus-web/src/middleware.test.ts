// @vitest-environment node
import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import middleware, { config } from '@/middleware';

// `auth` está sobrecargada en v5, así que se tipa el mock a mano. Sólo hace falta la forma
// que `isSessionValid` lee: `user.id` y `expiresAt` en la raíz de la sesión (no en `user`).
const mockAuth = vi.fn<() => Promise<{ user?: { id?: string }; expiresAt?: number } | null>>();
vi.mock('@/features/auth/config/nextauth.config', () => ({
  auth: () => mockAuth(),
}));

// Se mockea para poder afirmar que el middleware NO llama a la red (TS-6). El guard no
// debería hacer una sola request: es lo que hace que CA-12 se cumpla por construcción.
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * `config.matcher` es un string que Next compila en build con `path-to-regexp`;
 * `middleware()` NO lo evalúa en runtime. Acá se compila como regex crudo, que es una
 * aproximación: coincide con la de Next para ESTE matcher —sintaxis de regex, un solo grupo,
 * un lookahead negativo, sin `:param` ni modificadores de path-to-regexp— y por eso TS-1
 * afirma además el string literal, que es inmune a cualquier divergencia de compilación.
 *
 * Los anclajes `^` y `$` no son decorativos: sin ellos `matcherRe.test('/api/...')` daría
 * `true` (encontraría coincidencia más adentro del string) y TS-3 pasaría afirmando lo
 * contrario de lo que quiere probar.
 */
const matcherRe = new RegExp(`^${config.matcher}$`);

const validSession = () => ({ user: { id: 'u1' }, expiresAt: Date.now() + 3600000 });

describe('middleware config.matcher (estructural: es config de build, no runtime)', () => {
  it('TS-1 [CA-1]: el matcher ya no excluye `attachments` — igualdad exacta de string', () => {
    // Igualdad exacta y no sólo `!includes('attachments')`: borrar el token y dejar el pipe
    // (`api||_next/static`) crea una alternativa vacía que hace que el lookahead rechace
    // TODO path, o sea que el middleware no correría nunca y el portal quedaría sin guard.
    // Esa regresión pasaría un `includes` y falla acá.
    expect(config.matcher).toBe('/((?!api|_next/static|_next/image|favicon.ico).*)');
    expect(config.matcher.includes('attachments')).toBe(false);
  });

  it('TS-2 [CA-1]: el guard alcanza el link viejo de adjunto — es el cambio real', () => {
    expect(matcherRe.test('/attachments/123/informe.pdf')).toBe(true);
    expect(matcherRe.test('/attachments/999999/privado.pdf')).toBe(true);
    expect(matcherRe.test('/attachments/1/a b.pdf')).toBe(true);
  });

  it('TS-3 [CA-5, CA-6]: `api/*` sigue FUERA del matcher — regresión del camino autenticado', () => {
    // Esta aserción existe para impedir que un "limpiemos el matcher" futuro se lleve el
    // prefijo `api`. Si eso pasara, rompería de una el preview de adjuntos, las imágenes
    // embebidas en markdown y el proxy catch-all entero: los route handlers manejan su
    // propia auth y un 401 convertido en redirect a /login es inútil para una llamada axios.
    expect(matcherRe.test('/api/attachments/45/preview')).toBe(false);
    expect(matcherRe.test('/api/files/45/preview')).toBe(false);
    expect(matcherRe.test('/api/opus/projects/1/requirements')).toBe(false);
    expect(matcherRe.test('/api/auth/session')).toBe(false);
  });

  it('TS-4 [CA-1]: los estáticos siguen excluidos — el regex no se rompió al editarlo', () => {
    expect(matcherRe.test('/_next/static/chunks/main.js')).toBe(false);
    expect(matcherRe.test('/_next/image')).toBe(false);
    expect(matcherRe.test('/favicon.ico')).toBe(false);
  });

  it('TS-5 [CA-1]: `/login` y las rutas de pantalla siguen alcanzadas por el matcher', () => {
    // `/login` TIENE que estar alcanzado: es lo que permite el rebote a `/` con sesión
    // válida. Un test que lo asuma excluido afirmaría lo contrario del código.
    expect(matcherRe.test('/login')).toBe(true);
    expect(matcherRe.test('/projects/1/requirements')).toBe(true);
  });
});

describe('middleware() (comportamiento del guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-6 [CA-1, CA-8, CA-12]: link viejo sin sesión → 307 a /login sin tocar la red', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await middleware(
      new NextRequest('http://localhost:3000/attachments/123/informe.pdf')
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('http://localhost:3000/login');
    // La aserción de CA-8 y CA-12: no hay llamada a la `api`, así que no hay comando
    // `files.{fileId}.request-download` en el bus y con `core` caído el resultado es idéntico.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-7 [CA-1]: sesión con `expiresAt` vencido también redirige — no es sólo "hay cookie"', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1' }, expiresAt: Date.now() - 1000 });

    const res = await middleware(
      new NextRequest('http://localhost:3000/attachments/123/informe.pdf')
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('http://localhost:3000/login');
  });

  it('TS-8 [CA-2]: con sesión válida el middleware deja pasar (el 404 lo resuelve el App Router)', async () => {
    mockAuth.mockResolvedValueOnce(validSession());

    const res = await middleware(
      new NextRequest('http://localhost:3000/attachments/123/informe.pdf')
    );

    // La aserción que manda: no es un redirect.
    expect(res.headers.get('Location')).toBeNull();
    expect(res.status).toBe(200);
    // Corroboración del `NextResponse.next()`. `x-middleware-next` es un detalle interno de
    // Next: si una versión futura lo cambia, las dos aserciones de arriba son las que valen.
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('TS-9 [CA-1]: regresión del guard general — ruta protegida sin sesión sigue redirigiendo', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await middleware(new NextRequest('http://localhost:3000/projects/1/requirements'));

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('http://localhost:3000/login');
  });

  it('TS-10: `/login` sin sesión no redirige — no hay loop de redirects', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await middleware(new NextRequest('http://localhost:3000/login'));

    expect(res.headers.get('Location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('TS-11: `/login` con sesión válida rebota a `/`', async () => {
    mockAuth.mockResolvedValueOnce(validSession());

    const res = await middleware(new NextRequest('http://localhost:3000/login'));

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('http://localhost:3000/');
  });
});
