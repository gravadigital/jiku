import { createSign } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Access tokens de un service user de Zitadel, para conectarse al bus.
 *
 * El servicio guarda la key JSON del machine user (la que entrega Zitadel en
 * Keys -> New -> JSON) y pide un token cuando lo necesita. Antes el token venía por
 * variable de entorno y expiraba en ~1h, lo que obligaba a reiniciar los servicios.
 *
 * EL TOKEN TIENE QUE SER JWT
 *   El auth-callout valida por JWKS: verifica la firma localmente, sin llamar a Zitadel.
 *   Un token opaco no tiene firma que verificar y la conexión se rechaza con
 *   `Authorization Violation`. Por defecto Zitadel emite tokens OPACOS para machine
 *   users: se cambia por usuario, en Access Token Type = JWT.
 *
 * LOS ROLES NO VIENEN SOLOS
 *   El token solo incluye los roles si se pide el scope
 *   `urn:zitadel:iam:org:projects:roles` — el genérico, no el de un proyecto puntual.
 *   Sin roles el callout no matchea ninguna regla y rechaza la conexión.
 */

export interface ServiceUserKey {
  type: string;
  keyId: string;
  key: string;
  userId: string;
}

export interface ZitadelAuthOptions {
  /** La key del service user: el JSON ya parseado. */
  key: ServiceUserKey;
  /** La instancia de Zitadel, p.ej. https://id.example.com */
  issuer: string;
  /** Acota la audiencia del token a un proyecto. Recomendado. */
  projectId?: string;
  /**
   * Cuántos segundos antes del vencimiento se pide uno nuevo. Con margen para que un
   * token no expire en medio de una operación.
   */
  refreshMarginSeconds?: number;
}

interface CachedToken {
  token: string;
  /** Epoch en segundos. */
  expiresAt: number;
}

const DEFAULT_REFRESH_MARGIN = 300;
/** Vigencia del assertion que se firma para pedir el token. No es la del token. */
const ASSERTION_TTL = 300;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Cliente de tokens con cache.
 *
 * `token()` devuelve el vigente y solo pide uno nuevo cuando está por vencer, así que se
 * puede llamar en cada reconexión sin costo.
 */
export class ZitadelServiceUser {
  private key: ServiceUserKey;
  private issuer: string;
  private projectId?: string;
  private refreshMargin: number;
  private cached: CachedToken | null = null;
  /** Evita pedir varios tokens a la vez si llegan llamadas concurrentes. */
  private inFlight: Promise<string> | null = null;

  constructor(options: ZitadelAuthOptions) {
    this.key = options.key;
    if (!this.key.keyId || !this.key.key || !this.key.userId) {
      throw new Error('La key del service user necesita keyId, key y userId');
    }
    this.issuer = options.issuer.replace(/\/$/, '');
    this.projectId = options.projectId;
    this.refreshMargin = options.refreshMarginSeconds ?? DEFAULT_REFRESH_MARGIN;
  }

  /**
   * El token cacheado, sin ir a la red.
   *
   * `tokenAuthenticator` de nats.js espera una función SÍNCRONA, así que la renovación se
   * dispara aparte (ver `startAutoRefresh`) y acá solo se devuelve lo último obtenido.
   */
  currentToken(): string {
    if (!this.cached) {
      throw new Error('Todavía no se pidió ningún token: llamá a token() primero');
    }
    return this.cached.token;
  }

  /**
   * Renueva el token en segundo plano, antes de que venza.
   *
   * Devuelve una función para detenerlo. El timer no bloquea la salida del proceso.
   */
  startAutoRefresh(onError?: (error: Error) => void): () => void {
    const tick = async () => {
      try {
        await this.token();
      } catch (error) {
        onError?.(error as Error);
      }
    };

    // A mitad del margen: siempre se renueva con holgura antes del vencimiento.
    const interval = setInterval(tick, (this.refreshMargin / 2) * 1000);
    interval.unref?.();
    return () => clearInterval(interval);
  }

  /** El id de usuario de Zitadel: es la `session` del service user en los subjects. */
  get userId(): string {
    return this.key.userId;
  }

  /** Un token vigente, pidiendo uno nuevo solo si hace falta. */
  async token(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (this.cached && this.cached.expiresAt - this.refreshMargin > now) {
      return this.cached.token;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.fetchToken()
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private async fetchToken(): Promise<string> {
    const assertion = this.signAssertion();

    const scopes = [
      'openid',
      'profile',
      // Sin este scope el token no trae los roles y el callout rechaza la conexión.
      'urn:zitadel:iam:org:projects:roles',
    ];
    if (this.projectId) {
      scopes.push(`urn:zitadel:iam:org:project:id:${this.projectId}:aud`);
    }

    const response = await fetch(`${this.issuer}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        scope: scopes.join(' '),
        assertion,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Zitadel devolvió ${response.status} al pedir el token: ${detail}`);
    }

    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    const token = body.access_token;
    if (!token) {
      throw new Error('Zitadel no devolvió access_token');
    }

    if (token.split('.').length !== 3) {
      throw new Error(
        `Zitadel emitió un token OPACO para el usuario ${this.key.userId}. ` +
          'El auth-callout valida por JWKS y lo va a rechazar: poné ' +
          'Access Token Type = JWT en ese machine user.'
      );
    }

    const now = Math.floor(Date.now() / 1000);
    this.cached = {
      token,
      // `expires_in` es lo que informa Zitadel; si no viene, se asume una hora.
      expiresAt: now + (body.expires_in ?? 3600),
    };
    return token;
  }

  /** JWT firmado con la private key, que se cambia por el access token. */
  private signAssertion(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', kid: this.key.keyId }));
    // El assertion va dirigido a Zitadel, así que la audiencia es el issuer.
    const payload = base64url(
      JSON.stringify({
        iss: this.key.userId,
        sub: this.key.userId,
        aud: this.issuer,
        iat: now,
        exp: now + ASSERTION_TTL,
      })
    );

    const signature = createSign('RSA-SHA256')
      .update(`${header}.${payload}`)
      .sign(this.key.key);

    return `${header}.${payload}.${base64url(signature)}`;
  }
}

/**
 * Lee la key del service user desde el entorno. Dos formas, en este orden:
 *
 *   ZITADEL_SERVICE_USER_KEY_B64   el JSON en base64 (una sola variable, sin archivos)
 *   ZITADEL_SERVICE_USER_KEY       ruta a un archivo JSON montado
 *
 * La variable en base64 es la más simple de operar: viaja en el `.env` como cualquier
 * otro secreto y no obliga a montar volúmenes. El JSON crudo no sirve porque la private
 * key lleva saltos de línea escapados y se rompe al pasar por un `.env`.
 */
export function serviceUserKeyFromEnv(): ServiceUserKey | null {
  const encoded = process.env.ZITADEL_SERVICE_USER_KEY_B64;
  if (encoded) {
    try {
      return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ServiceUserKey;
    } catch (error) {
      throw new Error(
        `ZITADEL_SERVICE_USER_KEY_B64 no es un JSON válido en base64: ${(error as Error).message}`
      );
    }
  }

  const keyPath = process.env.ZITADEL_SERVICE_USER_KEY;
  if (keyPath) {
    return JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceUserKey;
  }

  return null;
}

/**
 * Arma el cliente desde variables de entorno.
 *
 * Devuelve `null` si no hay key configurada: en desarrollo el callout puede correr con su
 * IdP mock y no hace falta Zitadel.
 */
export function serviceUserFromEnv(): ZitadelServiceUser | null {
  const key = serviceUserKeyFromEnv();
  const issuer = process.env.ZITADEL_ISSUER_URL || process.env.IDENTITY_ISSUER;

  if (!key || !issuer) {
    return null;
  }

  return new ZitadelServiceUser({
    key,
    issuer,
    projectId: process.env.ZITADEL_PROJECT_ID,
  });
}
