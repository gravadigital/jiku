'use strict';
import * as jwt from 'jsonwebtoken';
import { DecodedToken } from '../../lib/interfaces/decoded-token';
type Jwt = typeof jwt;
const IDENTITY_ISSUER = process.env.IDENTITY_ISSUER || '';
const IDENTITY_CLIENT_ID = process.env.IDENTITY_CLIENT_ID || '';
let jsonwebtoken: Jwt;

const internalTokens: Record<string, DecodedToken> = {
  token_01_user: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575001',
    nbf: 1720887138,
    sub: 'zitadel-sub-01',
    'urn:zitadel:iam:org:project:roles': {
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
  token_02_user: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575002',
    nbf: 1720887138,
    sub: 'zitadel-sub-02',
    'urn:zitadel:iam:org:project:roles': {
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
  token_03_admin: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575003',
    nbf: 1720887138,
    sub: 'zitadel-sub-03',
    'urn:zitadel:iam:org:project:roles': {
      'admin': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
  // S-029: el único token del mock CON claims de perfil. Existe para probar que los tres viajan en
  // el sobre y que `preferred_username` se mapea a `username`; los otros cuatro NO SE TOCAN, porque
  // su ausencia de perfil es justamente el otro caso que hay que cubrir (CA-11).
  token_05_user_profile: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575005',
    nbf: 1720887138,
    sub: 'zitadel-sub-05',
    name: 'Ana Pérez',
    preferred_username: 'ana@grava.digital',
    email: 'ana@grava.digital',
    'urn:zitadel:iam:org:project:roles': {
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
  token_04_external_user: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575003',
    nbf: 1720887138,
    sub: 'zitadel-sub-04',
    'urn:zitadel:iam:org:project:roles': {
      'external-user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
  // REQ-012/S-049 (TS-21, CA-14): roles MIXTOS ['user', 'external-user']. Necesario para
  // ejercitar `access_denied` end-to-end desde HTTP: un `external-user` puro nunca llega a la
  // compuerta de entidad de `core` (`authorizeEntityAccess`) porque el mapa rol->método ya lo
  // corta antes con `caller_not_authorized` (ver TS-9/TS-10/TS-21 con `token_04_external_user`
  // más abajo). Con roles mixtos, el método SÍ está autorizado (por `user`), pero
  // `resolveCallerClass` (core/src/caller-class.ts) elige la clase MÁS RESTRICTIVA -> cae en
  // `external` por precedencia, y ahí sí corre la compuerta de entidad sobre
  // `user_project_permissions`. Sub distinto a propósito, para no acoplar este caso al
  // fixture de otro describe.
  token_07_user_and_external_mixed: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575007',
    nbf: 1720887138,
    sub: 'zitadel-sub-07',
    'urn:zitadel:iam:org:project:roles': {
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      },
      'external-user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
  // S-034 (TS-12, CA-14): un external-user AUTENTICADO sin NINGUNA fila en
  // user_project_permissions -- a diferencia de zitadel-sub-04, que algunos tests le crean
  // una fila de permiso. Sub distinto a propósito, para no acoplar este caso al fixture de
  // otro describe.
  token_06_external_user_no_permissions: {
    aud: [
      IDENTITY_CLIENT_ID,
      '275672248377933829'
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575006',
    nbf: 1720887138,
    sub: 'zitadel-sub-06',
    'urn:zitadel:iam:org:project:roles': {
      'external-user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    }
  },
};

function verify(token: string, _secret: jwt.Secret | jwt.GetPublicKeyOrSecret, callback: (error: boolean, decoded?: any) => void) {
  if (internalTokens[token]) {
    return callback(false, internalTokens[token]);
  }
  return callback(true);
}

function sign(data: string | object | Buffer, secret: jwt.Secret, configurations?: jwt.SignOptions) {
  return jsonwebtoken.sign(data, secret, configurations);
}

function original() {
  return jsonwebtoken;
}

export default (realJWT: Jwt) => {
  jsonwebtoken = realJWT;
  return {
    verify,
    sign,
    original
  };
};
