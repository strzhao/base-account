export type CliOptionDef = {
  name: string;
  short?: string;
  description: string;
  required: boolean;
  type: "string" | "boolean" | "number";
};

export type CliArgDef = {
  name: string;
  description: string;
  required: boolean;
};

export type CliCommandDef = {
  path: string[];
  description: string;
  api: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
  };
  arguments?: CliArgDef[];
  options?: CliOptionDef[];
  outputHint?: "json" | "table";
};

export type CliManifest = {
  version: string;
  commands: CliCommandDef[];
};

export function buildCliManifest(): CliManifest {
  return {
    version: "2026-03-06.1",
    commands: [
      // --- Users ---
      {
        path: ["admin", "users", "list"],
        description: "List all users",
        api: { method: "GET", path: "/api/admin/users" },
        options: [
          { name: "query", short: "q", description: "Search by email", required: false, type: "string" }
        ],
        outputHint: "table"
      },
      {
        path: ["admin", "users", "detail"],
        description: "Get user detail including sessions and audit logs",
        api: { method: "GET", path: "/api/admin/users/:userId" },
        arguments: [
          { name: "userId", description: "User ID", required: true }
        ],
        outputHint: "json"
      },
      {
        path: ["admin", "users", "set-status"],
        description: "Set user status (ACTIVE or DISABLED)",
        api: { method: "POST", path: "/api/admin/users/:userId/status" },
        arguments: [
          { name: "userId", description: "User ID", required: true }
        ],
        options: [
          { name: "status", short: "s", description: "ACTIVE or DISABLED", required: true, type: "string" }
        ]
      },

      // --- Services ---
      {
        path: ["admin", "services", "list"],
        description: "List all registered services",
        api: { method: "GET", path: "/api/admin/services" },
        options: [
          { name: "query", short: "q", description: "Search by name or domain", required: false, type: "string" }
        ],
        outputHint: "table"
      },
      {
        path: ["admin", "services", "create"],
        description: "Register a new service",
        api: { method: "POST", path: "/api/admin/services" },
        options: [
          { name: "origin", description: "Service origin URL", required: true, type: "string" },
          { name: "displayName", description: "Display name", required: false, type: "string" },
          { name: "serviceKey", description: "Service key identifier", required: false, type: "string" },
          { name: "consentSummary", description: "Consent summary text", required: false, type: "string" }
        ]
      },
      {
        path: ["admin", "services", "toggle"],
        description: "Enable or disable a service",
        api: { method: "POST", path: "/api/admin/services/:serviceId/toggle" },
        arguments: [
          { name: "serviceId", description: "Service ID", required: true }
        ],
        options: [
          { name: "enabled", description: "true or false", required: true, type: "boolean" }
        ]
      },

      // --- API Keys ---
      {
        path: ["admin", "api-keys", "list"],
        description: "List all API keys for current user",
        api: { method: "GET", path: "/api/admin/api-keys" },
        outputHint: "table"
      },
      {
        path: ["admin", "api-keys", "create"],
        description: "Create a new API key (key is shown only once)",
        api: { method: "POST", path: "/api/admin/api-keys" },
        options: [
          { name: "name", description: "Key name for identification", required: true, type: "string" }
        ]
      },
      {
        path: ["admin", "api-keys", "revoke"],
        description: "Revoke an API key",
        api: { method: "DELETE", path: "/api/admin/api-keys/:id" },
        arguments: [
          { name: "id", description: "API Key ID", required: true }
        ]
      },

      // --- Invitation Codes ---
      {
        path: ["invitation-codes", "list"],
        description: "List my invitation codes for a service",
        api: { method: "GET", path: "/api/auth/invitation-codes" },
        options: [
          { name: "serviceKey", short: "s", description: "Service key", required: true, type: "string" }
        ],
        outputHint: "table"
      },
      {
        path: ["invitation-codes", "generate"],
        description: "Generate a new invitation code",
        api: { method: "POST", path: "/api/auth/invitation-codes/generate" },
        options: [
          { name: "serviceKey", short: "s", description: "Service key", required: true, type: "string" }
        ]
      },
      {
        path: ["invitation-codes", "validate"],
        description: "Validate an invitation code (check if it is valid and unused)",
        api: { method: "POST", path: "/api/auth/invitation-codes/validate" },
        options: [
          { name: "code", short: "c", description: "Invitation code to validate", required: true, type: "string" }
        ]
      },
      {
        path: ["invitation-codes", "redeem"],
        description: "Redeem an invitation code",
        api: { method: "POST", path: "/api/auth/invitation-codes/redeem" },
        options: [
          { name: "code", short: "c", description: "Invitation code to redeem", required: true, type: "string" }
        ]
      },
      {
        path: ["invitation-codes", "revoke"],
        description: "Revoke an invitation code",
        api: { method: "POST", path: "/api/auth/invitation-codes/revoke" },
        options: [
          { name: "codeId", description: "Invitation code ID", required: true, type: "string" }
        ]
      },

      // --- Email Codes ---
      {
        path: ["admin", "email-codes", "list"],
        description: "List recent email verification codes (for debugging)",
        api: { method: "GET", path: "/api/admin/email-codes" },
        options: [
          { name: "limit", short: "l", description: "Number of records", required: false, type: "number" }
        ],
        outputHint: "table"
      }
    ]
  };
}
