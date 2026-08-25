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
