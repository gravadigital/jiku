import {NextFunction, Request, Response} from 'express';
import {decodeAuthToken, getRolesFromToken} from '../auth-helper';
import { User } from '@jiku/models';
import logger from '../../logger';

const IDENTITY_URL = process.env.IDENTITY_URL as string;

/**
 * Bypass de autenticación para desarrollo local.
 *
 * Es **opt-in explícito**: hace falta declarar `AUTH_BYPASS=true` y estar fuera de
 * producción. Antes se activaba solo con que faltara `IDENTITY_URL`, así que una variable
 * sin completar dejaba la api abierta y con rol `admin` para todo el mundo, en silencio.
 *
 * Nunca se infiere de que falte configuración: si falta `IDENTITY_URL` y no hay bypass
 * declarado, el proceso no arranca (ver `assertAuthConfig`).
 */
const AUTH_BYPASS_REQUESTED = process.env.AUTH_BYPASS === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BYPASS_AUTH = AUTH_BYPASS_REQUESTED && !IS_PRODUCTION;

/** Usuario que se carga con el bypass activo. Sin default: si no está, el bypass falla. */
const DEV_USER_ID = process.env.DEV_USER_ID;

/**
 * Corta el arranque si la configuración de autenticación no es utilizable. Es preferible
 * no levantar a levantar con la api abierta.
 */
export function assertAuthConfig() {
  if (AUTH_BYPASS_REQUESTED && IS_PRODUCTION) {
    throw new Error(
      'AUTH_BYPASS=true no está permitido con NODE_ENV=production: la api quedaría abierta.'
    );
  }
  if (BYPASS_AUTH) {
    if (!DEV_USER_ID) {
      throw new Error('AUTH_BYPASS=true requiere DEV_USER_ID: sin eso no hay usuario que cargar.');
    }
    logger.warn(
      'AUTH_BYPASS activo: la api NO valida tokens y trata a todas las requests como admin. ' +
      'Solo para desarrollo local.'
    );
    return;
  }
  if (!IDENTITY_URL || IDENTITY_URL.trim() === '') {
    throw new Error(
      'Falta IDENTITY_URL. Configurala con la instancia de Zitadel, o declará AUTH_BYPASS=true ' +
      'fuera de producción para desarrollo local.'
    );
  }
}

function getJwt(req: Request) {
  // Solo por header. El fallback por query param (`?jwt=`) se eliminó: los query params
  // quedan en logs de acceso, historial y Referer, y express-winston los registra.
  if (req.headers.authorization && req.headers.authorization.indexOf('Bearer') !== -1) {
    return req.headers.authorization.replace('Bearer ', '');
  }
  return undefined;
}

function validateToken(req: Request, res: Response, next: NextFunction) {
  if (BYPASS_AUTH) {
    logger.warn(`AUTH_BYPASS: request sin autenticar tratada como admin — ${req.method} ${req.path}`);
    return User.findByPk(DEV_USER_ID as string)
      .then((user) => {
        if (!user) {
          logger.error(`AUTH_BYPASS: DEV_USER_ID ${DEV_USER_ID} no existe en la base`);
          return res.status(401).json({
            code: 'unauthorized',
            message: 'Unauthorized'
          });
        }
        // El bypass sigue leyendo la fila real (herramienta de desarrollo local, AC-6 de la
        // Tarea 1 — no se toca su mecanismo), pero `req.user` ahora es `ClaimUser`, no el
        // modelo Sequelize: se adapta campo a campo para mantener el mismo tipo en las dos
        // ramas de la función.
        req.user = {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email ?? undefined,
          roles: ['admin'],
        };
        req.decodedToken = {
          sub: user.id,
          email: user.email,
          name: user.name
        } as any;
        req.decodedTokenRoles = ['admin'];
        return next();
      })
      .catch((error) => {
        logger.error('AUTH_BYPASS: error cargando el usuario de desarrollo:', error);
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Unauthorized'
        });
      });
  }

  const token = getJwt(req) as string;
  if (!token) {
    return res.status(401).json({
      code: 'unauthorized',
      message: 'Unauthorized'
    });
  }
  return decodeAuthToken(token)
    .then((decodedToken) => {
      req.token = token;
      req.decodedToken = decodedToken;
      req.decodedTokenRoles = getRolesFromToken(req.decodedToken);
      // Desde S-034 (D-6, H-5): `req.user` se arma DEL CLAIM ya verificado contra el JWKS, sin
      // consultar `users`. El `sub` no tiene que existir en la tabla — la fila es un espejo
      // best-effort (S-029), no una condición para operar. Mismo criterio que `buildActor`
      // (`lib/utils/bus/actor.ts`), que ya arma el sobre del bus de esta misma forma.
      req.user = {
        id: decodedToken.sub,
        name: decodedToken.name,
        username: decodedToken.preferred_username,
        email: decodedToken.email,
        roles: req.decodedTokenRoles,
      };
      return next();
    })
    .catch(() => {
      return res.status(401).json({
        code: 'unauthorized',
        message: 'Unauthorized'
      });
    });
}

export default validateToken;
