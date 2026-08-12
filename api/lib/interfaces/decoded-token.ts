export interface DecodedToken {
  aud: string[];
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  sub: string;
  'urn:zitadel:iam:org:project:roles': Record<string, Record<string, string>>;
}
