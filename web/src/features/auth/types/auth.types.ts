export interface Person {
  id?: number;
  firstName: string;
  lastName: string;
  enabled: boolean;
  initDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  PersonObjective?: { isLeader: boolean };
}

export interface User {
  id?: string;
  name: string;
  username: string;
  email: string;
}

export interface UserCredentials {
  username: string;
  password: string;
}

export interface CustomError {
  status?: number;
  code?: string;
  message?: string;
}

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

export class Token {
  name: string;
  expiration: Date;

  constructor(_name: string, _exp: Date) {
    this.name = _name;
    this.expiration = _exp;
  }

  static fromJson(data: { name: string; exp: number }) {
    return new this(data.name, new Date(data.exp * 1000));
  }
}
