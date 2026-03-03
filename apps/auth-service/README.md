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

## Production email requirement

`RESEND_API_KEY` must be configured in production.  
If missing, `/api/auth/send-code` will fail intentionally.
