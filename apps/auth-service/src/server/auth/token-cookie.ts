import { authCookieNames } from "@/server/auth/cookies";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookieHeaderValues(cookieHeader: string, cookieName: string): string[] {
  const prefix = `${cookieName}=`;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => safeDecode(part.slice(prefix.length)))
    .map((value) => value.trim())
    .filter(Boolean);
}

function pickLongest(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  return values.sort((a, b) => b.length - a.length)[0];
}

export function selectAccessToken(candidates: string[]): string | undefined {
  const normalized = candidates.map((value) => value.trim()).filter(Boolean);
  const jwtLike = normalized.filter((value) => value.includes("."));
  return pickLongest(jwtLike) ?? pickLongest(normalized);
}

export function selectRefreshToken(candidates: string[]): string | undefined {
  const normalized = candidates.map((value) => value.trim()).filter(Boolean);
  const opaqueLike = normalized.filter((value) => value.length >= 24);
  return pickLongest(opaqueLike) ?? pickLongest(normalized);
}

export function readAccessFromCookieHeader(cookieHeader: string): string | undefined {
  return selectAccessToken(parseCookieHeaderValues(cookieHeader, authCookieNames.access));
}

export function readRefreshFromCookieHeader(cookieHeader: string): string | undefined {
  return selectRefreshToken(parseCookieHeaderValues(cookieHeader, authCookieNames.refresh));
}

type CookieStoreLike = {
  getAll(name: string): Array<{ value: string }>;
};

export function readAccessFromCookieStore(cookieStore: CookieStoreLike): string | undefined {
  const values = cookieStore.getAll(authCookieNames.access).map((item) => item.value);
  return selectAccessToken(values);
}
