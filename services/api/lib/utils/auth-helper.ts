import axios from 'axios';
import {createPublicKey} from 'crypto';
import jwt, {Jwt, JwtHeader, JwtPayload, SigningKeyCallback} from 'jsonwebtoken';
import logger from '../logger';
import { DecodedToken } from '../interfaces/decoded-token';
let keys: KeyInterface[];
const IDENTITY_URL = process.env.IDENTITY_URL as string;
const KEY_SYNC_ATTEMPS = Number(process.env.KEY_SYNC_ATTEMPS);

type T = Jwt | JwtPayload | string;
interface KeyInterface {
  use: string;
  kty: string;
  kid: string;
  alg: 'RS256';
  n: string;
  e: string;
}

function synchronizeIdentityKeys(): Promise<void> {
  if (!IDENTITY_URL) {
    return Promise.resolve();
  }
  return axios.get<{keys: KeyInterface[]}>(`${IDENTITY_URL}/oauth/v2/keys`)
    .then(({data}) => {
      keys = data.keys;
    })
    .catch((error) => {
      throw error;
    });
}

async function verifyingKeys(header: any): Promise<any> {
  let attempts = 0;
  let error = true;
  let publicKey;
  while (attempts < KEY_SYNC_ATTEMPS && error) {
    attempts++;
    keys.forEach((key) => {
      if (key.kid === header.kid) {
        publicKey = createPublicKey({
          key: {kty: key.kty, e: key.e, n: key.n},
          format: 'jwk'
        });
        error = false;
      }
    });
    if (error) {
      await synchronizeIdentityKeys();
    }
  }

  if (error) {
    throw new Error('Error to synchronize keys :(');
  }
  return publicKey;
}

async function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  let publicKey = null;
  let error = null;
  try {
    const result = await verifyingKeys(header);
    publicKey = result;
    error = false;
  } catch (err: any) {
    error = err;
    logger.error(`---- ${err.message} ----`);
    logger.error(`-- Token key: ${header.kid}`);
    logger.error('-- Current keys:');
    keys.forEach((key) => {
      logger.error(`-- ${key.kid}`);
    });
    logger.error('-----------------------');
  }
  return callback(error, publicKey);
}

function decodeAuthToken(token: string): Promise<DecodedToken> {
  return new Promise((resolve, reject) => {
    return jwt.verify(token, getKey, (err: Error | null, decoded: T | undefined) => {
      if (err) {
        return reject(err);
      }
      return resolve(decoded as DecodedToken);
    });
  });
}

function getKeys() {
  return keys;
}

function getRolesFromToken(decodedToken: DecodedToken) {
  if (!decodedToken['urn:zitadel:iam:org:project:roles']) {
    return [];
  }
  return Object.keys(decodedToken['urn:zitadel:iam:org:project:roles']);
}

function getUserInformationFromToken(token: string) {
  if (!IDENTITY_URL) {
    return Promise.resolve(null);
  }
  return axios({
    url: `${IDENTITY_URL}/oidc/v1/userinfo`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(({data}) => {
      return {
        name: data.name,
        email: data.email,
        username: data.preferred_username,
      };
    });
}

export {
  decodeAuthToken,
  getKey,
  getKeys,
  getRolesFromToken,
  synchronizeIdentityKeys,
  getUserInformationFromToken
};
