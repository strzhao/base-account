import { generateKeyPairSync } from "node:crypto";

import { UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createJwtManager } from "@/lib/jwt";

describe("jwt manager", () => {
  it("signs and verifies access tokens", async () => {
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });

    const privatePem = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const publicPem = pair.publicKey.export({ format: "pem", type: "spki" }).toString();

    const manager = createJwtManager({
      issuer: "https://auth.example.com",
      audience: "product-a",
      kid: "k1",
      privateKeyPem: privatePem,
      publicKeyPem: publicPem,
      accessTokenExpiresInSec: 900
    });

    const token = await manager.signAccessToken({
      sub: "user_1",
      email: "user@example.com",
      status: UserStatus.ACTIVE
    });

    const payload = await manager.verifyAccessToken(token);
    expect(payload.sub).toBe("user_1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.status).toBe(UserStatus.ACTIVE);

    const jwks = await manager.getJwks();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({
      kid: "k1",
      alg: "RS256"
    });
  });
});
