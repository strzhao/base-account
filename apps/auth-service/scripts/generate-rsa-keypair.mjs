import { generateKeyPairSync } from "node:crypto";

const pair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

const normalize = (pem) => pem.trim().replace(/\n/g, "\\n");

console.log("AUTH_PRIVATE_KEY_PEM=\"" + normalize(pair.privateKey) + "\"");
console.log("AUTH_PUBLIC_KEY_PEM=\"" + normalize(pair.publicKey) + "\"");
