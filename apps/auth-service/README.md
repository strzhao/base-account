# Auth Service

## Environment

Copy `.env.example` to `.env.local` and fill all required values.

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
/authorize?service=<service_id>&return_to=<absolute_url>&state=<opaque_state>
```

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
  --service base-account-client \
  --return-to https://ai-todo.stringzhao.life/auth/callback \
  --strict
```

The script validates:
- `/authorize` redirect integrity (`service`, `return_to`, `state`)
- `.vercel.app` callback allowlist
- unauthenticated `/api/auth/me` behavior
- invalid `return_to` rejection

GitHub Actions workflow (`.github/workflows/auth-flow-verify.yml`) runs this check:
- manually via workflow_dispatch
- automatically every 6 hours

## Production email requirement

`RESEND_API_KEY` must be configured in production.  
If missing, `/api/auth/send-code` will fail intentionally.
