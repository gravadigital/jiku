'use strict';
import * as jwt from 'jsonwebtoken';
import { DecodedToken } from '../../lib/interfaces/decoded-token';
type Jwt = typeof jwt;
const IDENTITY_ISSUER = process.env.IDENTITY_ISSUER || '';
const IDENTITY_CLIENT_ID = process.env.IDENTITY_CLIENT_ID || '';
// The product's project (ZITADEL_PROJECT_ID of .env.test). Its id is in the `aud` of every token
// below, and its roles claim is the only one the api reads (ACC-16).
const PROJECT_ID = process.env.ZITADEL_PROJECT_ID || '';
const OTHER_PROJECT_ID = '999999999999999999';

type RolesClaim = Record<string, Record<string, string>>;

/**
 * The two roles claims Zitadel puts in a token that asked for the product's project: the generic
 * one and the one of the project. They carry the same roles.
 */
function projectRoles(roles: RolesClaim, projectId = PROJECT_ID) {
  return {
    'urn:zitadel:iam:org:project:roles': roles,
    [`urn:zitadel:iam:org:project:${projectId}:roles`]: roles,
  };
}
let jsonwebtoken: Jwt;

const internalTokens: Record<string, DecodedToken> = {
  token_01_user: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575001',
    nbf: 1720887138,
    sub: 'zitadel-sub-01',
    ...projectRoles({
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  token_02_user: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575002',
    nbf: 1720887138,
    sub: 'zitadel-sub-02',
    ...projectRoles({
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  token_03_admin: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575003',
    nbf: 1720887138,
    sub: 'zitadel-sub-03',
    ...projectRoles({
      'admin': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  // S-029: el único token del mock CON claims de perfil. Existe para probar que los tres viajan en
  // el sobre y que `preferred_username` se mapea a `username`; los otros cuatro NO SE TOCAN, porque
  // su ausencia de perfil es justamente el otro caso que hay que cubrir (CA-11).
  token_05_user_profile: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
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
    ...projectRoles({
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  token_04_external_user: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575003',
    nbf: 1720887138,
    sub: 'zitadel-sub-04',
    ...projectRoles({
      'external-user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  // REQ-012/S-049 (TS-21, CA-14): roles MIXTOS ['user', 'external-user']. Necesario para
  // ejercitar `access_denied` end-to-end desde HTTP: un `external-user` puro nunca llega a la
  // compuerta de entidad de `core` (`authorizeEntityAccess`) porque el mapa rol->método ya lo
  // corta antes con `caller_not_authorized` (ver TS-9/TS-10/TS-21 con `token_04_external_user`
  // más abajo). Con roles mixtos, el método SÍ está autorizado (por `user`), pero
  // `resolveCallerClass` (services/core/src/caller-class.ts) elige la clase MÁS RESTRICTIVA -> cae en
  // `external` por precedencia, y ahí sí corre la compuerta de entidad sobre
  // `user_project_permissions`. Sub distinto a propósito, para no acoplar este caso al
  // fixture de otro describe.
  token_07_user_and_external_mixed: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575007',
    nbf: 1720887138,
    sub: 'zitadel-sub-07',
    ...projectRoles({
      'user': {
        '275648673470218245': 'grava.id.grava.io'
      },
      'external-user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  // S-034 (TS-12, CA-14): un external-user AUTENTICADO sin NINGUNA fila en
  // user_project_permissions -- a diferencia de zitadel-sub-04, que algunos tests le crean
  // una fila de permiso. Sub distinto a propósito, para no acoplar este caso al fixture de
  // otro describe.
  token_06_external_user_no_permissions: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575006',
    nbf: 1720887138,
    sub: 'zitadel-sub-06',
    ...projectRoles({
      'external-user': {
        '275648673470218245': 'grava.id.grava.io'
      }
    })
  },
  // S-077 (TS-54, TS-57): token válido y SIN ningún rol, para probar que `hasAnyRole` rechaza
  // con 403 aunque la autenticación pase (deny-by-default, ADR-008).
  token_08_no_roles: {
    aud: [
      IDENTITY_CLIENT_ID,
      PROJECT_ID
    ],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '275802564547575008',
    nbf: 1720887138,
    sub: 'zitadel-sub-08',
    ...projectRoles({})
  },
  // #626 (ACC-16, ACC-E1, 626-AC-01): tokens the api must refuse or read differently. Same
  // instance key (the mock skips the signature), so only the claims tell them apart.
  // Another issuer: a valid project audience and roles, but `iss` is not the configured instance.
  token_foreign_issuer_admin: {
    aud: [IDENTITY_CLIENT_ID, PROJECT_ID],
    exp: 1720959138,
    iat: 1720887138,
    iss: 'https://other-instance.example.com',
    jti: '626000000000000001',
    nbf: 1720887138,
    sub: 'zitadel-sub-626-01',
    ...projectRoles({ admin: { '275648673470218245': 'grava.id.grava.io' } }),
  },
  // A user of another project of the same instance: Zitadel puts `admin` in the generic claim
  // and in the claim of THAT project, and that project in `aud`. Before #626 the api took it as admin.
  token_foreign_project_admin: {
    aud: [IDENTITY_CLIENT_ID, OTHER_PROJECT_ID],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '626000000000000002',
    nbf: 1720887138,
    sub: 'zitadel-sub-626-02',
    ...projectRoles({ admin: { '275648673470218245': 'grava.id.grava.io' } }, OTHER_PROJECT_ID),
  },
  // The product's audience but only the generic roles claim: the identity has no roles.
  token_generic_roles_only_admin: {
    aud: [IDENTITY_CLIENT_ID, PROJECT_ID],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '626000000000000003',
    nbf: 1720887138,
    sub: 'zitadel-sub-626-03',
    'urn:zitadel:iam:org:project:roles': { admin: { '275648673470218245': 'grava.id.grava.io' } },
  },
  // A machine user's token (CRED-02) that asked for the project audience: `aud` as one string.
  token_machine_internal_app: {
    aud: PROJECT_ID,
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '626000000000000004',
    nbf: 1720887138,
    sub: 'zitadel-sub-626-04',
    ...projectRoles({ 'internal-app': { '275648673470218245': 'grava.id.grava.io' } }),
  },
  // A machine user's token that did NOT ask for the project audience: no exception for machines.
  token_machine_without_audience: {
    aud: ['zitadel-sub-626-05'],
    exp: 1720959138,
    iat: 1720887138,
    iss: IDENTITY_ISSUER,
    jti: '626000000000000005',
    nbf: 1720887138,
    sub: 'zitadel-sub-626-05',
    ...projectRoles({ admin: { '275648673470218245': 'grava.id.grava.io' } }),
  },
};

/**
 * A named token above skips the signature and returns its claims. Any other string goes to the
 * real `jsonwebtoken.verify`, so a test can sign a real token with a key it publishes through a
 * faked JWKS and exercise the signature and the key refetch (tests/routes/token-validation.test.ts).
 */
function verify(token: string, secret: jwt.Secret | jwt.GetPublicKeyOrSecret, callback: (error: any, decoded?: any) => void) {
  if (internalTokens[token]) {
    return callback(null, internalTokens[token]);
  }
  return jsonwebtoken.verify(token, secret as jwt.GetPublicKeyOrSecret, callback as jwt.VerifyCallback);
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
