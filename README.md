# NEXUS-E

Nigerian Environmental Expertise Exchange. Registration site for the Benin 2026 conference (PRD Phase 1).

Stack: React, TypeScript, Vite, Tailwind CSS v4, Supabase (Postgres, Auth, Row Level Security).

## Setup

You need Node.js 20 or newer and a Supabase project.

```bash
git clone https://github.com/great000-bit/NEXUX-E.git
cd NEXUX-E
cp .env.example .env.local     # on Windows PowerShell: Copy-Item .env.example .env.local
```

Open `.env.local` and fill in the values:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase, Project Settings, API, Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase, Project Settings, API, the `anon` public key. Never use the `service_role` key. |
| `VITE_SITE_URL` | `http://localhost:5173` locally, your real address in production |
| `VITE_TURNSTILE_SITE_KEY` | Leave empty until Cloudflare Turnstile is added |

Each value goes on the line with its own name. Restart `npm run dev` after any change to `.env.local`.

```bash
npm install
npm run dev                    # http://localhost:5173
```

Checks to run before every commit:

```bash
npm run lint && npm run typecheck && npm run build
```

## Database

Run the files in `supabase/migrations` in order in the Supabase SQL editor.

1. `20261007000001_experts.sql`: tables, the `NEX-000001` ID sequence and constraints.
2. `20261007000002_rls_and_rpc.sql`: Row Level Security and the `register_expert` function.
3. `20261007000003_ensure_unique_indexes.sql`: guarantees duplicate email and phone are blocked. Safe to repeat.

Then create the admin user and allow-list them:

1. Supabase, Authentication, Users, Add user (email and password).
2. Supabase, Authentication, Sign In / Providers, turn off new sign-ups.
3. Edit `supabase/seed_admin.example.sql` with that email in lowercase and run it in the SQL editor.

How access works:

- Row Level Security is on for every table. The public cannot read anything.
- The public can only call `register_expert(payload)`. It validates, checks the honeypot, applies a generous rate limit, inserts, and returns the Expert ID or an error code such as `duplicate_email`.
- Admin reads need a signed in user **and** a row in `public.admins` with the same email.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Welcome and how it works |
| `/register` | Three screen form, progress saved in sessionStorage |
| `/registered` | Confirmation with Expert ID and copy button |
| `/admin` | Admin sign in, dashboard, search, filters, record detail, CSV export |

## Deploy

Any static host works (Vercel, Netlify, Cloudflare Pages).

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: the same four as `.env.local`, set in the host's dashboard.
- Single page app rewrite: send every path to `/index.html`, otherwise refreshing `/register` or `/admin` shows a 404.
  - Netlify and Cloudflare Pages: already handled by `public/_redirects`.
  - Vercel: already handled by `vercel.json`.
- After deploying, set the Supabase Authentication URL configuration Site URL to your live address.

## Confirmation emails (Resend)

How it works: `register_expert` saves the registration and queues one row in `public.email_outbox`. A database trigger wakes the `send-confirmation-emails` Edge Function, which sends the email through Resend. A schedule retries failures every 10 minutes. Registration never waits for email: the trigger is asynchronous and swallows its own errors, so a Resend outage cannot fail a registration.

Row states: `pending`, `sending`, `sent`, `failed` (will retry with growing delays of 5, 20, 80 and 320 minutes), `dead` (gave up after 5 attempts or the address was rejected). Each expert can have only one confirmation row, and Resend is sent an idempotency key, so the same email is never sent twice.

The free Resend plan allows 100 emails a day. The function stops at 100 sent per UTC day (`EMAIL_DAILY_CAP`). If Resend itself reports the limit, the function logs `RESEND_DAILY_LIMIT_HIT`, leaves the remaining rows queued and tries again later. A bad key or unverified domain logs `RESEND_CONFIG_ERROR` and also leaves rows queued.

### Setup (once)

1. **Run the migration.** In the Supabase SQL editor, run `supabase/migrations/20261008000001_email_sender.sql`. If it complains about `pg_net` or `pg_cron`, enable both under Database, Extensions, then run it again.
2. **Create a webhook secret.** Run this and keep the output for the next two steps:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Fill in the function secrets.** Copy `supabase/functions/send-confirmation-emails/.env.example` to `supabase/.env.local` (gitignored) and set `RESEND_API_KEY` and `WEBHOOK_SECRET`. Never commit this file.
4. **Deploy the function and set the secrets.** You need the Supabase CLI and a login:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase secrets set --env-file supabase/.env.local
   npx supabase functions deploy send-confirmation-emails --no-verify-jwt
   ```
   The function checks its own `x-webhook-secret` header, so the JWT check is off (also set in `supabase/config.toml`).
5. **Tell the database where the function is.** In the SQL editor, with your own project ref and the secret from step 2:
   ```sql
   select vault.create_secret('https://<your-project-ref>.supabase.co/functions/v1/send-confirmation-emails', 'email_function_url');
   select vault.create_secret('<the same webhook secret>', 'email_webhook_secret');
   ```
   Until both exist, the trigger does nothing and rows simply wait in the outbox.

### Testing

- Unit tests for the sending rules and the email content: `npm run test:email`.
- Send one real email with the production template: `node scripts/send-test-email.mjs --to you@example.com --id NEX-000123 --name "Ada Obi" --title Dr`. It reads the key from `supabase/.env.local`.
- Full path: register a test expert, then look at the outbox. The status should become `sent` within seconds.
  ```sql
  select expert_id, status, attempts, last_error, sent_at from public.email_outbox order by id desc limit 10;
  ```
- To wake the sender by hand: `select public.invoke_email_sender('manual');`. Logs are under Edge Functions, `send-confirmation-emails`, Logs.
- Clean up test data, which also removes its outbox rows:
  ```sql
  delete from public.experts where full_name like '%(delete me)%' or full_name like 'TEST%';
  ```

### Operating it

- Rows that are `dead` need a human. After fixing the cause, requeue one with:
  ```sql
  update public.email_outbox set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null where id = <row id>;
  ```
- Settings: `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SITE_URL`, `EMAIL_DAILY_CAP`, `EMAIL_MAX_ATTEMPTS` and `EMAIL_BATCH_SIZE` are function secrets. Change them with `npx supabase secrets set NAME=value`.
- Registrations made before the function was switched on stay queued and are sent once it is live. Delete test registrations first so they do not receive email.

## Hooks left for later

- **Cloudflare Turnstile:** `src/components/Turnstile.tsx` is the slot for the widget. The place to verify the token is marked in the second migration.
- **QR code:** generated in `public/qr` by `npm run qr`.

## Design tokens

Colours were sampled from the conference flier (`docs/flier.jpg`) and live in `src/index.css` under `@theme`. The emblem is rebuilt as vector in `src/components/Logo.tsx` and `public/logo-mark.svg`.
