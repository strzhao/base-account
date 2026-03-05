import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashValue(value: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export function compareHash(value: string, expectedHash: string, pepper: string): boolean {
  const actual = hashValue(value, pepper);
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expectedHash);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function generateNumericCode(length = 6): string {
  const digits: string[] = [];
  for (let index = 0; index < length; index += 1) {
    digits.push(String(randomInt(0, 10)));
  }

  return digits.join("");
}

export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

const INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInvitationCode(length = 8): string {
  const bytes = randomBytes(length);
  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    chars.push(INVITATION_ALPHABET[bytes[i] % INVITATION_ALPHABET.length]);
  }
  return chars.join("");
}

export function getClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }

  const realIp = headers.get("x-real-ip");
  return realIp?.trim() || undefined;
}
