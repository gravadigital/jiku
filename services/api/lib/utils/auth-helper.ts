import axios from 'axios';
import {createPublicKey} from 'crypto';
import jwt, {Jwt, JwtHeader, JwtPayload, SigningKeyCallback} from 'jsonwebtoken';
import logger from '../logger';
import { DecodedToken } from '../interfaces/decoded-token';
let keys: KeyInterface[] = [];
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

/**
 * What the api expects of every token (#626, DEC-T34): the issuer of the configured instance, as
 * it goes in `iss` (`IDENTITY_ISSUER`, which may differ from `IDENTITY_URL`, the address the keys
 * are fetched from), and the product's project (`ZITADEL_PROJECT_ID`), which must be in `aud` and
 * whose roles claim is the only one read. Read on every call: `assertAuthConfig` refuses to start
 * without them.
 */
function expectedIssuer(): string {
  return (process.env.IDENTITY_ISSUER || '').trim().replace(/\/+$/, '');
}

function projectId(): string {
  return (process.env.ZITADEL_PROJECT_ID || '').trim();
}

/** A token whose signature verifies but that is not for this product. The message is the reason. */
class TokenNotForThisProduct extends Error {}

/**
 * Same instance is not enough: another project or organization of the instance signs with the
 * same keys. No exception for machine tokens (CRED-02): they ask for the project audience too.
 */
function assertTokenIsForThisProduct(decoded: DecodedToken): void {
  const issuer = expectedIssuer();
  const tokenIssuer = typeof decoded.iss === 'string' ? decoded.iss.replace(/\/+$/, '') : '';
  if (!issuer || tokenIssuer !== issuer) {
    throw new TokenNotForThisProduct(`issuer "${decoded.iss}" is not the configured issuer "${issuer}"`);
  }
  const project = projectId();
  const audience = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
  if (!project || !audience.includes(project)) {
    throw new TokenNotForThisProduct(`audience ${JSON.stringify(decoded.aud)} does not include the project "${project}"`);
  }
}

function decodeAuthToken(token: string): Promise<DecodedToken> {
  return new Promise((resolve, reject) => {
    return jwt.verify(token, getKey, (err: Error | null, decoded: T | undefined) => {
      if (err) {
        return reject(err);
      }
      try {
        assertTokenIsForThisProduct(decoded as DecodedToken);
      } catch (error) {
        return reject(error);
      }
      return resolve(decoded as DecodedToken);
    });
  });
}

function getKeys() {
  return keys;
}

/**
 * Only the roles claim of the product's project: the generic one carries the roles of whichever
 * project the token was asked for. Without the claim, no roles (ACC-16).
 */
function getRolesFromToken(decodedToken: DecodedToken) {
  const claim = decodedToken[`urn:zitadel:iam:org:project:${projectId()}:roles`];
  if (!claim || typeof claim !== 'object') {
    return [];
  }
  return Object.keys(claim);
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
  expectedIssuer,
  projectId,
  getKey,
  getKeys,
  getRolesFromToken,
  synchronizeIdentityKeys,
  getUserInformationFromToken
};
