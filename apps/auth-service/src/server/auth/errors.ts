import { NextResponse } from "next/server";

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      },
      { status: error.statusCode }
    );
  }

  console.error("[auth] Unhandled route error", error);
  return NextResponse.json(
    {
      error: "internal_error",
      message: "An unexpected error occurred."
    },
    { status: 500 }
  );
}
