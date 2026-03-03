# Repository Guidelines

## Project Structure & Module Organization
This is an npm workspace monorepo:
- `apps/auth-service`: Next.js auth service (App Router).
- `packages/auth-sdk`: publishable JWT verification SDK.

Key auth-service paths:
- `src/app`: pages and API route handlers (`/api/**`, `/login`, `/authorize`, `/docs`, `/admin`).
- `src/server/auth`: server-side auth logic (tokens, sessions, authorization, admin guards).
- `src/lib`: shared utilities (env parsing, JWT, security, Prisma client, mailer).
- `prisma/schema.prisma` and `prisma/migrations/*`: database schema and migrations.

Tests are colocated as `src/**/*.test.ts`.

## Build, Test, and Development Commands
Run from repository root unless noted:
- `npm run dev`: start auth service locally.
- `npm run build`: build auth service and SDK.
- `npm run test`: run Vitest for both workspaces.
- `npm run lint`: lint auth service with Next.js ESLint.
- `npm run keys:generate`: generate RSA keypair for auth service.

Workspace-specific examples:
- `npm --prefix apps/auth-service run test:watch`
- `npm --prefix packages/auth-sdk run build`

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode), ES modules.
- Use 2-space indentation and semicolons.
- Use path alias `@/*` inside `apps/auth-service`.
- React components: `PascalCase`; utility modules/functions: clear `camelCase` names.
- Keep API contracts explicit and validated (use `zod` at route boundaries).
- For Prisma changes, commit both schema updates and migration SQL.

## Testing Guidelines
- Framework: Vitest (`vitest run`).
- Test files must be named `*.test.ts` and placed near related code.
- Cover auth-critical paths: token validation, session refresh/logout, redirect/`return_to` safety, and error mapping.
- Before opening PRs, run: `npm run test && npm run build`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (observed): `type(scope): summary`, e.g. `feat(账号系统): ...`.
- Keep commits focused and atomic; avoid mixing refactors with behavior changes.
- PRs should include:
  - concise problem/solution summary,
  - impacted routes/modules,
  - migration notes (if Prisma changed),
  - test/build results,
  - UI screenshots for page changes.

## Security & Configuration Tips
- Node.js version: `>=22`.
- Never commit secrets (`.env.local`, private keys, API keys).
- Keep `return_to`/origin validation strict for authorization flows.
