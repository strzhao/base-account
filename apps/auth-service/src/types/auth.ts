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
