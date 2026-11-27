export interface TokenInfo {
  accessToken: string;
  sub: string;
  user: {
    id: string;
    roles: string[];
  };
  expiresAt: number;
  iat: number;
  exp: number;
  jti: string;
}
