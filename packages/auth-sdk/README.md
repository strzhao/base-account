# @stringzhao/auth-sdk

Token verification SDK for Base Account.

## Install

```bash
npm install @stringzhao/auth-sdk
```

## Usage

### Verify with JWKS URL

```ts
import { createRemoteJwksVerifier } from "@stringzhao/auth-sdk";

const verifier = createRemoteJwksVerifier({
  jwksUrl: "https://user.stringzhao.life/.well-known/jwks.json",
  config: {
    issuer: "https://user.stringzhao.life",
    audience: "base-account-client"
  }
});

const payload = await verifier.verifyAccessToken(token);
console.log(payload.sub, payload.email, payload.status);
```

### Verify with RSA public key

```ts
import { verifyAccessTokenWithPublicKey } from "@stringzhao/auth-sdk";

const payload = await verifyAccessTokenWithPublicKey({
  token,
  publicKeyPem,
  config: {
    issuer: "https://user.stringzhao.life",
    audience: "base-account-client"
  }
});
```

## Token claims

The SDK validates JWT signature/issuer/audience and requires these claims:

- `sub`
- `email`
- `status`

