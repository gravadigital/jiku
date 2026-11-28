/** Zitadel's roles claim: `{ "<role>": { "<orgId>": "<domain>" } }`. */
export type RolesClaim = Record<string, Record<string, string>>;

export interface DecodedToken {
  // A JWT may carry one audience as a string or several as an array (RFC 7519 §4.1.3).
  aud: string | string[];
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  sub: string;
  // The generic claim carries the roles of the project the token was asked for, whichever it is:
  // the api never reads it (#626, ACC-16). It reads only the claim of the product's project.
  'urn:zitadel:iam:org:project:roles'?: RolesClaim;
  [projectRoles: `urn:zitadel:iam:org:project:${string}:roles`]: RolesClaim | undefined;
  // Los tres son OPCIONALES porque el access token los trae SOLO si la instancia de Zitadel los
  // emite con los scopes `profile` / `email` que piden los dos frontends. Su ausencia no rechaza
  // nada: el espejo de core es best-effort en los campos de perfil (CA-11).
  name?: string;
  preferred_username?: string;
  email?: string;
}

/**
 * `req.user` a partir de S-034: se arma DEL CLAIM ya verificado, no de una fila de `users`
 * (D-6, H-5). Deja de ser una instancia del modelo Sequelize `User` — es un objeto plano con
 * los mismos cinco campos que ya arma `buildActor` (`lib/utils/bus/actor.ts`), que es el
 * precedente exacto de este patrón.
 *
 * `name`, `username` y `email` son OPCIONALES por la misma razón que en `DecodedToken`: el
 * access token solo los trae si la instancia de Zitadel los emite con scope `profile`/`email`.
 * `roles` es obligatorio: sin claim de roles, `[]` (nunca `undefined`).
 */
export interface ClaimUser {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  roles: string[];
}
