export { DOC_VERSION, ISSUER, AUDIENCE, JWKS_URL } from "@/app/docs/content-base";
export type { QuickStep, EndpointSpec, TemplateSpec } from "@/app/docs/content-base";

export {
  quickStartSteps,
  endpointSpecs,
  templateSpecs,
  rolloutChecklist,
  externalIntegrationChecklist,
  troubleshooting,
  buildAuthFeedText
} from "@/app/docs/content-auth";

export {
  invitationCodeSteps,
  invitationCodeEndpoints,
  invitationCodeTemplate,
  buildInvitationCodesFeedText
} from "@/app/docs/content-invitation";

import { DOC_VERSION } from "@/app/docs/content-base";
import {
  endpointSpecs,
  externalIntegrationChecklist,
  quickStartSteps,
  rolloutChecklist,
  templateSpecs,
  buildAuthFeedText
} from "@/app/docs/content-auth";
import {
  invitationCodeEndpoints,
  invitationCodeSteps,
  buildInvitationCodesFeedText
} from "@/app/docs/content-invitation";

export const machineReadableSpec = {
  docVersion: DOC_VERSION,
  generatedAt: "2026-03-06",
  service: "base-account-auth",
  issuer: "https://user.stringzhao.life",
  audience: "base-account-client",
  jwksUrl: "https://user.stringzhao.life/.well-known/jwks.json",
  authorizeContract: {
    entryPath: "/authorize",
    requiredQuery: ["return_to", "state"],
    optionalQuery: ["service (deprecated)"],
    callbackQuery: ["authorized", "state"]
  },
  endpoints: endpointSpecs.map((item) => ({
    method: item.method,
    path: item.path,
    auth: item.auth,
    purpose: item.purpose,
    errors: item.errorNotes
  })),
  integrationSteps: quickStartSteps,
  templates: templateSpecs.map((item) => ({
    id: item.id,
    title: item.title,
    runtime: item.runtime
  })),
  checklist: rolloutChecklist,
  externalIntegrationChecklist,
  invitationCodes: {
    description: "邀请码系统：每用户每应用可生成 N 个一次性邀请码，兑换后记录邀请关系。",
    defaultQuota: 3,
    endpoints: invitationCodeEndpoints.map((item) => ({
      method: item.method,
      path: item.path,
      auth: item.auth,
      purpose: item.purpose,
      errors: item.errorNotes
    })),
    integrationSteps: invitationCodeSteps
  }
};

export function buildAiFeedText(): string {
  const lines: string[] = [];
  lines.push(buildAuthFeedText());
  lines.push("");
  lines.push(buildInvitationCodesFeedText());
  lines.push("");
  lines.push("## Machine Readable JSON");
  lines.push(JSON.stringify(machineReadableSpec, null, 2));
  return lines.join("\n");
}
