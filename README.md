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

## Hooks left for later

- **Confirmation email:** `register_expert` queues a row in `public.email_outbox` (status `pending`) for each registrant with an email. A later Edge Function or scheduled job should send the email, then set `status = 'sent'`. No email is sent yet.
- **Cloudflare Turnstile:** `src/components/Turnstile.tsx` is the slot for the widget. The place to verify the token is marked in the second migration.
- **QR code:** not part of this pass. Point it at a redirect you control so the destination can change after printing.

## Design tokens

Colours were sampled from the conference flier (`docs/flier.jpg`) and live in `src/index.css` under `@theme`. The emblem is rebuilt as vector in `src/components/Logo.tsx` and `public/logo-mark.svg`.
