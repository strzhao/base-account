import { UserStatus } from "@prisma/client";

export type UserDTO = {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AuthSuccessResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDTO;
};

export type ServiceIconMode = "FAVICON" | "CUSTOM" | "GENERATED";

export type AdminServiceDTO = {
  id: string;
  serviceKey: string;
  displayName: string;
  origin: string;
  hostname: string;
  iconUrl: string | null;
  iconMode: ServiceIconMode;
  consentSummary: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LinkedEmailDTO = {
  id: string;
  email: string;
  createdAt: string;
};

export type AdminServiceSuggestionDTO = {
  origin: string;
  hostname: string;
  serviceKey: string;
  displayName: string;
  iconUrl: string | null;
  consentSummary: string;
  existingService: AdminServiceDTO | null;
};
