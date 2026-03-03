import { generateKeyPairSync } from "node:crypto";

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { verifyAccessTokenWithPublicKey } from "./index";

describe("verifyAccessTokenWithPublicKey", () => {
  it("verifies a valid RS256 token", async () => {
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });

    const publicPem = pair.publicKey.export({ format: "pem", type: "spki" }).toString();

    const token = await new SignJWT({ email: "admin@example.com", status: "ACTIVE" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("user_1")
      .setIssuer("https://auth.example.com")
      .setAudience("product-a")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(pair.privateKey);

    const payload = await verifyAccessTokenWithPublicKey({
      token,
      publicKeyPem: publicPem,
      config: {
        issuer: "https://auth.example.com",
        audience: "product-a"
      }
    });

    expect(payload.sub).toBe("user_1");
    expect(payload.email).toBe("admin@example.com");
    expect(payload.status).toBe("ACTIVE");
  });
});
