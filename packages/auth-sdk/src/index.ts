import {
  createRemoteJWKSet,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey
} from "jose";

export type AuthVerifierConfig = {
  issuer: string;
  audience: string;
};

export type AccessTokenUser = JWTPayload & {
  sub: string;
  email: string;
  status: string;
};

function assertStringClaim(payload: JWTPayload, key: "sub" | "email" | "status"): string {
  const value = payload[key];
  if (typeof value !== "string") {
    throw new Error(`Token claim ${key} must be a string.`);
  }

  return value;
}

async function verifyToken(
  token: string,
  key: JWTVerifyGetKey,
  config: AuthVerifierConfig
): Promise<AccessTokenUser> {
  const { payload } = await jwtVerify(token, key, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256"]
  });

  return {
    ...payload,
    sub: assertStringClaim(payload, "sub"),
    email: assertStringClaim(payload, "email"),
    status: assertStringClaim(payload, "status")
  };
}

export async function verifyAccessTokenWithPublicKey(input: {
  token: string;
  publicKeyPem: string;
  config: AuthVerifierConfig;
}): Promise<AccessTokenUser> {
  const key = await importSPKI(input.publicKeyPem, "RS256");
  return verifyToken(input.token, () => Promise.resolve(key), input.config);
}

export function createRemoteJwksVerifier(input: {
  jwksUrl: string;
  config: AuthVerifierConfig;
}) {
  const jwks = createRemoteJWKSet(new URL(input.jwksUrl));

  return {
    verifyAccessToken: async (token: string): Promise<AccessTokenUser> => {
      return verifyToken(token, jwks, input.config);
    }
  };
}
