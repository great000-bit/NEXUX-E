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
4. `20261008000001_email_sender.sql`, `20261008000002_security_hardening.sql`, `20261008000003_function_secrets.sql`: confirmation emails and security fixes. See Confirmation emails below.

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

How it works: `register_expert` saves the registration and queues one row in `public.email_outbox`. A database trigger wakes the `send-confirmation-emails` Edge Function within a second, and the function sends the email through Resend. A schedule retries failures every 10 minutes. Registration never waits for email: the trigger is asynchronous and swallows its own errors, so a Resend outage cannot fail a registration.

Row states: `pending`, `sending`, `sent`, `failed` (will retry after 5, 20, 80 and 320 minutes), `dead` (gave up after 5 attempts or the address was rejected). Each expert can have only one confirmation row, and Resend receives an idempotency key built from the outbox row id, so the same email is never sent twice.

The free Resend plan allows 100 emails a day. The function stops at 100 sent per UTC day (`EMAIL_DAILY_CAP`). If Resend itself reports the limit, the function logs `RESEND_DAILY_LIMIT_HIT`, leaves the remaining rows queued and tries again later. A bad key or unverified domain logs `RESEND_CONFIG_ERROR` and also leaves rows queued, untouched.

### How production was set up

Done on 8 October 2026 for the `nexus-e` Supabase project. Repeat these steps for another project.

1. **Migrations.** Apply, in order, `20261008000001_email_sender.sql` (outbox columns, claim function, trigger, retry schedule; it enables `pg_net` and `pg_cron`), `20261008000002_security_hardening.sql` and `20261008000003_function_secrets.sql`.
2. **Deploy the function** with verify-JWT turned off, because it checks its own `x-webhook-secret` header:
   ```bash
   npx supabase functions deploy send-confirmation-emails --no-verify-jwt
   ```
3. **Store three secrets in Supabase Vault** (SQL editor). The webhook secret is generated inside the database, so nobody has to see or copy it:
   ```sql
   select vault.create_secret('<Resend sending-only key>', 'resend_api_key');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_webhook_secret');
   select vault.create_secret('https://<your-project-ref>.supabase.co/functions/v1/send-confirmation-emails', 'email_function_url');
   ```
   The trigger uses `email_function_url` and `email_webhook_secret`. The function reads `resend_api_key` and `email_webhook_secret`. If you prefer, set `RESEND_API_KEY` and `WEBHOOK_SECRET` as Edge Function environment secrets instead: the environment wins when both exist.
4. **Resend.** `nexuse.org` is verified. The key is a "Sending access" key restricted to that domain, so it cannot read or manage anything.

Optional function settings (environment secrets): `EMAIL_FROM` (default `NEXUS-E <noreply@nexuse.org>`), `EMAIL_REPLY_TO`, `SITE_URL`, `EMAIL_DAILY_CAP`, `EMAIL_MAX_ATTEMPTS`, `EMAIL_BATCH_SIZE`.

### Rotating the Resend key

Create a new sending-only key in Resend, then replace the Vault value. A Resend key is exactly 36 characters, so check the length after pasting:

```sql
select vault.update_secret(id, '<new key>') from vault.secrets where name = 'resend_api_key';
select length(decrypted_secret) from vault.decrypted_secrets where name = 'resend_api_key';
```

### Testing

- Unit tests for the sending rules and the email content: `npm run test:email`.
- Send one real email with the production template, straight to Resend: `node scripts/send-test-email.mjs --to you@example.com --id NEX-000123 --name "Ada Obi" --title Dr`. It reads a key from `supabase/.env.local` (gitignored).
- Full path: register a test expert on the live site, then look at the outbox. The status should become `sent` within a few seconds.
  ```sql
  select expert_id, status, attempts, last_error, sent_at from public.email_outbox order by id desc limit 10;
  ```
- To wake the sender by hand: `select public.invoke_email_sender('manual');`. Logs are under Edge Functions, `send-confirmation-emails`, Logs.
- Clean up test data (delete the outbox first, then reset the numbering):
  ```sql
  delete from public.email_outbox;
  delete from public.experts where full_name like '%(delete me)%';
  alter sequence public.expert_id_seq restart with 1;  -- only when the table is empty
  ```

### Operating it

- Rows that are `dead` need a human. After fixing the cause, requeue one with:
  ```sql
  update public.email_outbox set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null where id = <row id>;
  ```
- Registrations made before the sender was switched on stay queued and are emailed once it is live. Delete test registrations first so they do not receive email.

## Hooks left for later

- **Cloudflare Turnstile:** `src/components/Turnstile.tsx` is the slot for the widget. The place to verify the token is marked in the second migration.
- **QR code:** generated in `public/qr` by `npm run qr`.

## Design tokens

Colours were sampled from the conference flier (`docs/flier.jpg`) and live in `src/index.css` under `@theme`. The emblem is rebuilt as vector in `src/components/Logo.tsx` and `public/logo-mark.svg`.
