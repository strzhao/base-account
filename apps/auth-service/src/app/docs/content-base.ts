export const DOC_VERSION = "2026-03-06.2";
export const ISSUER = "https://user.stringzhao.life";
export const AUDIENCE = "base-account-client";
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

export type QuickStep = {
  title: string;
  detail: string;
};

export type EndpointSpec = {
  method: "GET" | "POST";
  path: string;
  auth: "none" | "access_token" | "refresh_token";
  purpose: string;
  requestExample?: string;
  responseExample: string;
  errorNotes: string[];
};

export type TemplateSpec = {
  id: string;
  title: string;
  runtime: string;
  code: string;
};
