# Auth Service

## Environment

Copy `.env.example` to `.env.local` and fill all required values.

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
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

## Production email requirement

`RESEND_API_KEY` must be configured in production.  
If missing, `/api/auth/send-code` will fail intentionally.
