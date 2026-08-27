export interface DecodedToken {
  aud: string[];
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  sub: string;
  'urn:zitadel:iam:org:project:roles': Record<string, Record<string, string>>;
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
