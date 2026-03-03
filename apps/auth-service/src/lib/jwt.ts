import { UserStatus } from "@prisma/client";
import {
  SignJWT,
  exportJWK,
  importPKCS8,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  type KeyLike
} from "jose";

import { getEnv } from "@/lib/env";

export type AccessTokenClaims = {
  sub: string;
  email: string;
  status: UserStatus;
};

export type VerifiedAccessToken = JWTPayload & AccessTokenClaims;

export type JwtManagerConfig = {
  issuer: string;
  audience: string;
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
  accessTokenExpiresInSec: number;
};

function withRequiredString(payload: JWTPayload, key: "sub" | "email" | "status"): string {
  const value = payload[key];
  if (typeof value !== "string") {
    throw new Error(`Token missing required claim: ${key}`);
  }

  return value;
}

export function createJwtManager(config: JwtManagerConfig) {
  const privateKeyPromise = importPKCS8(config.privateKeyPem, "RS256");
  const publicKeyPromise = importSPKI(config.publicKeyPem, "RS256");

  async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const privateKey = await privateKeyPromise;

    return new SignJWT({
      email: claims.email,
      status: claims.status
    })
      .setProtectedHeader({
        alg: "RS256",
        kid: config.kid,
        typ: "JWT"
      })
      .setSubject(claims.sub)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime(`${config.accessTokenExpiresInSec}s`)
      .sign(privateKey);
  }

  async function verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    const publicKey = await publicKeyPromise;

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256"]
    });

    return {
      ...payload,
      sub: withRequiredString(payload, "sub"),
      email: withRequiredString(payload, "email"),
      status: withRequiredString(payload, "status") as UserStatus
    };
  }

  async function getJwks(): Promise<{ keys: Record<string, unknown>[] }> {
    const publicKey = (await publicKeyPromise) as KeyLike;
    const jwk = await exportJWK(publicKey);

    return {
      keys: [
        {
          ...jwk,
          alg: "RS256",
          kid: config.kid,
          use: "sig"
        }
      ]
    };
  }

  return {
    signAccessToken,
    verifyAccessToken,
    getJwks
  };
}

let runtimeManager: ReturnType<typeof createJwtManager> | null = null;

function getRuntimeManager() {
  if (runtimeManager) {
    return runtimeManager;
  }

  const env = getEnv();
  runtimeManager = createJwtManager({
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE,
    kid: env.AUTH_JWT_KID,
    privateKeyPem: env.AUTH_PRIVATE_KEY_PEM,
    publicKeyPem: env.AUTH_PUBLIC_KEY_PEM,
    accessTokenExpiresInSec: env.ACCESS_TOKEN_EXPIRES_IN_SEC
  });

  return runtimeManager;
}

export function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return getRuntimeManager().signAccessToken(claims);
}

export function verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
  return getRuntimeManager().verifyAccessToken(token);
}

export function getPublicJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  return getRuntimeManager().getJwks();
}

export function resetJwtManagerForTests(): void {
  runtimeManager = null;
}
