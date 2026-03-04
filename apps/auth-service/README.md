# Auth Service

## Environment

Copy `.env.example` to `.env.local` and fill all required values.

Production requirement:

- `AUTH_COOKIE_DOMAIN` must be configured (recommended: `.stringzhao.life`).
- In `production`, the service fails fast if this value is empty or invalid.
- This is required for cross-subdomain clients (for example `ai-todo.stringzhao.life`) to send `refresh_token` back through server-side relay endpoints.

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run verify:auth-flow` (run from repo root)
- `npm run keys:generate`

## Admin Access

Add admin emails to:

```env
ADMIN_EMAILS="admin@yourdomain.com,ops@yourdomain.com"
```

Only these users can access `/admin` and `/api/admin/*`.

## External service authorization entry

Use a unified authorize URL for same-domain services:

```text
/authorize?return_to=<absolute_url>&state=<opaque_state>
```

- `service` query is backward-compatible but ignored by server-side service identity resolution.
- Admin must register and enable the `return_to` origin in `/admin` -> Services first.
- Unauthenticated users are redirected to `/login` automatically.
- Logged-in users with existing consent are redirected to `return_to` directly.
- First-time users see a consent confirmation page and then continue.

Allowlist configuration (recommended):

```env
AUTH_ALLOWED_RETURN_ORIGINS="http://localhost:3000,https://user.stringzhao.life,https://stringzhao.life"
AUTH_ALLOWED_RETURN_SUFFIXES=".stringzhao.life,.vercel.app"
```

## Continuous acceptance demo

Use the minimal smoke verifier to validate the new authorize flow continuously:

```bash
npm run verify:auth-flow
```

Optional arguments:

```bash
npm run verify:auth-flow -- \
  --base-url https://user.stringzhao.life \
  --return-to https://user.stringzhao.life/app \
  --strict
```

The script validates:
- `/authorize` redirect integrity (`return_to`, `state`)
- `.vercel.app` callback allowlist
- unauthenticated `/api/auth/me` behavior
- invalid `return_to` rejection

GitHub Actions workflow (`.github/workflows/auth-flow-verify.yml`) runs this check:
- manually via workflow_dispatch
- automatically every 6 hours

## Production email requirement

`RESEND_API_KEY` must be configured in production.  
If missing, `/api/auth/send-code` will fail intentionally.
