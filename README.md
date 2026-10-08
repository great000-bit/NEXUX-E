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
5. `20261009000001` to `20261009000004`: Phase 2 verification. See Verification below.
6. `20261010000001_email_required_and_settings.sql`: email required for new registrations, the `admin_set_expert_email` action, and the Reply-To and contact settings.
7. `20261010000002_orphan_files.sql`: lets the daily job remove stored files that no record points to.
8. `20261011000001_phase3_directory_and_opportunities.sql`: the public directory and project opportunities. See Directory and opportunities (Phase 3) below. Additive only: nothing existing is changed or removed.

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
| `/verify` | Expert sign-in with an emailed one-time code |
| `/verify/dashboard` | Status, evidence upload and submit for review |
| `/admin` | Admin sign in, registrations (search, filters, status, detail, CSV export) |
| `/admin/verification` | Review queue by status, then `/admin/verification/NEX-000123` to review one expert |
| `/experts` | Public directory of Verified Experts who chose to be listed: search, filters, sorting, pages |
| `/experts/NEX-000123` | One public profile (not found unless that expert is Verified and listed) |
| `/admin/opportunities` | Opportunities: list by status, then `/new` and `/<id>` to create or edit, see who is interested, export CSV |

## Deploy

Any static host works (Vercel, Netlify, Cloudflare Pages).

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: the same four as `.env.local`, set in the host's dashboard.
- Single page app rewrite: send every path to `/index.html`, otherwise refreshing `/register` or `/admin` shows a 404.
  - Netlify and Cloudflare Pages: already handled by `public/_redirects`.
  - Vercel: already handled by `vercel.json`.
- After deploying, set the Supabase Authentication URL configuration Site URL to your live address.

## Verification (Phase 2)

Experts upload evidence of their membership, licence and qualification. Administrators review it and decide. Everything is private, every decision is logged, and the expert is emailed at each step.

### Statuses

| Status | Meaning |
| --- | --- |
| Pending | Registered, no evidence submitted yet |
| Under review | Evidence submitted, waiting for an administrator |
| More evidence needed | An administrator asked for more. The expert can add or replace files and submit again |
| Verified | Approved |
| Not verified | Rejected, with a reason the expert can read |

The PRD names three statuses (Pending, Verified, Not verified). The two extra ones, Under review and More evidence needed, are the working states between them.

### What an expert does

1. Open `/verify` and enter the email they registered with. A 6 digit code is emailed to them. The code works once, expires in 10 minutes, and five wrong guesses cancel it. The page gives the same answer whether or not the email is registered, so nobody can use it to find out who has registered. Expert IDs alone are never accepted, because they are sequential and guessable.
2. On `/verify/dashboard` they read the privacy notice and agree to it, then upload documents: a membership card or certificate (they pick the body, such as NES or IEPN), a licence, a qualification certificate, and an optional CV. PDF, JPG or PNG only, 5 MB each, up to 8 files. Files are checked by their contents, not their names. Big phone photos are shrunk in the browser before upload (to under 2 MB and at most 2000 pixels on the longest side, saved as JPG), PDFs are left exactly as they are, and a friendly message appears if a file is still over the 5 MB limit. Until they submit, they can delete and replace files.
3. They press **Submit for review**. The status becomes Under review and the files are locked.

Email is required when registering (phone is optional but checked if given). Older records that were saved with a phone number only have no email, so those experts cannot sign in until an administrator adds one: open the record in **Registrations**, and the detail panel shows an **Add email** box. The address is checked, must not belong to another expert, and the change is written to the decision log without copying the address into it.

### What an administrator does

In `/admin`, the **Verification** tab shows counts per status and a queue, oldest first. Opening an expert shows their registered details beside their files, with a viewer for PDFs and images. Choose **Approve**, **Request more evidence** (a message is required) or **Reject** (a reason is required), add optional internal notes, and confirm. The expert is emailed. Every decision is written to the decision log, which nobody can edit or delete.

The registrations table has a status badge, a status filter, and the CSV export includes the status, the submission date, who reviewed it, and when.

**Data requests.** On an expert's review page, *Export this expert's data* downloads a JSON file (their record, the names of files uploaded, the decision log and the emails sent), and *Delete uploaded files* removes their files from storage and logs it.

### How it is protected

- **Experts have no database login.** The `expert-portal` Edge Function checks their session on every call and only ever touches that expert's own record and files. Sessions last 2 hours.
- **Private storage.** The `expert-evidence` bucket is private, has no public URLs, and has no policy for the public or for experts. Administrators can read and remove files, and open them only through short lived signed links. Experts open their own files through 60 second signed links created after an ownership check. File paths are random, contain no Expert ID, and are never written to logs.
- **Uploads go straight to storage** through a one-time signed URL, and the function then downloads the stored bytes to check them: the type must be PDF, JPG or PNG by its real content, the stored type must agree, the size must be 5 MB or less, and PDFs with scripts or launch actions are refused. Anything else is deleted at once.
- **Administrators stay separate.** They sign in with Supabase Auth and must be on `public.admins`. Expert sessions are never accepted for admin actions, and admin logins are never accepted as expert sessions.
- **Rate limits.** Code requests: 3 per email and 10 per network every 15 minutes. Code guesses: 20 per network every 15 minutes. A daily cap on sign-in emails (`PORTAL_DAILY_CODE_CAP`, default 40) stops anyone using up the Resend allowance of 100 emails a day.
- **The decision log** (`verification_audit`) is append only. No API role can write to it, and database triggers reject any update, delete or truncate.

### Retention of rejected uploads

When an expert is marked Not verified, their files are deleted after a retention period. The default is **30 days**. It is a setting in the database:

```sql
select key, value from public.verification_settings;
update public.verification_settings set value = '14' where key = 'rejected_retention_days';
```

A daily job (pg_cron, 03:00 UTC) calls the `verification-admin` function, which deletes the files of every expert who has been Not verified for longer than that, logs it, clears uploads that were started but never finished, and removes any stored file that no record points to (for example after an expert's record is deleted, which removes the file records but not the stored files). Verified experts keep their files until an administrator deletes them. The Not verified email tells the expert that files are only kept for a short time.

### Setup

1. **Migrations.** Run in order: `20261009000001_verification_schema.sql`, `20261009000002_verification_functions.sql`, `20261009000003_verification_maintenance.sql`, `20261009000004_session_index.sql`. They also create the private bucket and its policies.
2. **Vault secrets** (SQL editor). `portal_pepper` is a random salt for hashing network addresses. `verification_function_url` is where the daily job calls. The existing `resend_api_key` and `email_webhook_secret` are reused.
   ```sql
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'portal_pepper');
   select vault.create_secret('https://<your-project-ref>.supabase.co/functions/v1/verification-admin', 'verification_function_url');
   ```
3. **Deploy three functions.** `expert-portal` and `verification-admin` with the JWT check off (they do their own checks), and the updated `send-confirmation-emails`:
   ```bash
   npx supabase functions deploy expert-portal --no-verify-jwt
   npx supabase functions deploy verification-admin --no-verify-jwt
   npx supabase functions deploy send-confirmation-emails --no-verify-jwt
   ```
4. **Optional function settings** (Edge Function secrets): `ALLOWED_ORIGINS` (default `https://register.nexuse.org`), `CONTACT_EMAIL` (shown in the Not verified email), `PORTAL_DAILY_CODE_CAP`, plus the existing `EMAIL_FROM` and `EMAIL_REPLY_TO`. Set `EMAIL_REPLY_TO` before launch, so experts who reply to a status email reach a real inbox.

### Emails

The four status emails (evidence received, more evidence needed, verified, not verified) use the same outbox, retry rules, daily cap and "never twice" guarantee as the confirmation email. Each decision creates exactly one outbox row, keyed to its entry in the decision log. The sign-in code email is sent straight away rather than queued, because a code that arrives late is useless.

### Testing

```bash
npm test                              # unit and regression tests for the app, the emails and the portal
node scripts/regression-live.mjs      # read-only checks against the real project (public access is locked down)
node scripts/regression-live.mjs --write   # also registers one labelled test expert and tries duplicates
```

The live script prints the SQL that removes the test expert it created. The decision log cannot be edited, so test decisions made through the review screen stay in it. See the note under Operating.

### Operating

- **Test data in the decision log.** Because the log is append only, rows created while testing cannot be deleted through the app. If you reset the Expert ID numbering after testing, delete the test rows first, or the next `NEX-000001` will inherit them. Doing that deliberately means pausing the protection for a moment, from the SQL editor as the project owner:
  ```sql
  alter table public.verification_audit disable trigger verification_audit_no_change;
  delete from public.verification_audit where expert_id in ('NEX-000001', 'NEX-000002');  -- the test experts only
  alter table public.verification_audit enable trigger verification_audit_no_change;
  ```
  Never do this for real decisions.
- **Stuck or unwanted sessions.** `update public.expert_sessions set revoked_at = now() where expert_id = 'NEX-000123';`

## Directory and opportunities (Phase 3)

Two things were added, and nothing about registration or verification changed.

### The public directory

- **Who appears.** Only experts who are **Verified** and answered **Yes** to "Discoverable by organisations". Nobody else, ever: not in the list, not in search, not by typing their profile address, not through the API.
- **How that is enforced.** In the database, not the page. The public (anon) role still cannot read any table. It can call exactly two functions, `directory_search` and `directory_profile`, and both only return rows where `verification_status = 'verified'` and `discoverable is true`, with a fixed list of public fields. A test reads the migration to keep it that way.
- **What is shown.** Title and name, position and organisation, state, primary and secondary expertise, years of experience, highest qualification, memberships, the assignments the expert is open to, geographic availability, the optional profile link, and a Verified Expert badge. Never a phone number, an email address or any evidence file.
- **Taking effect at once.** There is no cache. If an expert turns listing off, or their status stops being Verified, their page returns "not available" on the next request.
- **Search engines.** A listed expert's page says `index, follow` and has a canonical link on `register.nexuse.org`. Every other state says `noindex`. `public/robots.txt` keeps `/admin` and `/verify` out of search.
- **Speed on weak data.** The directory pages load only when opened (registration's bundle did not grow), pages hold 12 experts, and the list returns only the fields the cards show.
- **The expert's control.** On their dashboard, "Your public listing" says exactly what becomes public and has one button to list or remove themselves. Each change is written to the verification log.

### Opportunities

- **Admin, Opportunities tab.** Create, edit, publish (Open), close and delete. Fields: title, description, type (the same assignment options as registration), expertise needed, location, deadline, status (Draft, Open, Closed).
- **Deadlines.** An opportunity stays open through the whole of its deadline day, Nigerian time, then stops showing to experts and stops accepting interest. It is shown to the admin as "Open, past deadline" until they close it.
- **What experts see.** Open opportunities on their dashboard. Ones whose expertise needed includes the expert's primary or secondary expertise, or whose type is an assignment the expert chose at registration, come first with a "Matches your profile" label. That is a plain comparison and nothing more.
- **Express interest.** Only Verified Experts, only on an open opportunity before its deadline. They can withdraw at any time. Closed, draft and expired opportunities refuse interest in the database.
- **What the admin sees.** For each opportunity, the experts who currently have their hand up, with the details they registered, and an Export CSV button.
- **The notification email.** When an expert expresses interest, one email goes to `opportunity_notify_email` (below), through the same outbox, retries and daily cap as every other email. It is sent once per expert and opportunity, so switching interest off and on cannot flood the inbox. It names the expert and the opportunity and links to the admin screen. It carries no phone number or email address.
- **The change log.** Every create, edit, publish, close, reopen and delete is written to `public.opportunity_audit`. Like the verification log, it cannot be updated, deleted or truncated, and it survives deleting the opportunity.
- **Not built, on purpose.** Organisation accounts, in-site messaging and automatic matching emails.

### Testing Phase 3

- `npm test` includes `src/phase3.test.ts` (privacy and migration rules), `src/lib/directoryFilters.test.ts`, `src/lib/opportunities.test.ts` and the CSV tests.
- `node scripts/regression-live.mjs` checks a real project with only the public key: nothing private is readable, the new functions are closed, and the directory returns only public fields. Add `--write` to also prove a new expert who said Yes to discoverability stays hidden until verified. Add `--env=.env.staging.local` to point it at the staging project.
- Staging is a separate free Supabase project (`nexus-e-staging`). Run the migrations and deploy the three Edge Functions there first, point the Vercel **Preview** environment variables at it, and only then release to production.

## Settings you can change

These live in `public.verification_settings` (readable by administrators only). An Edge Function secret of the same purpose overrides the first two if you ever set one.

| Setting | Edge Function secret | Used for |
| --- | --- | --- |
| `email_reply_to` | `EMAIL_REPLY_TO` | The Reply-To header on every email: registration confirmation, sign-in codes and the four status emails. Replies from experts land here. |
| `contact_email` | `CONTACT_EMAIL` | The address named in the Not verified email ("please write to ..."). |
| `opportunity_notify_email` | none | Where the "an expert is interested" email goes. Starts as the contact address. Leave it empty to turn those emails off. |
| `allowed_origins_extra` | none | Optional. Extra web addresses (comma separated) allowed to call the Edge Functions, such as a Vercel preview address. Not set in production. |

All of the first three are currently `greatemmanwori@gmail.com`. To change them, in the SQL editor:

```sql
update public.verification_settings set value = 'help@nexuse.org' where key in ('email_reply_to', 'contact_email', 'opportunity_notify_email');
```

`rejected_retention_days` (default 30) lives in the same table.

## Supabase Auth settings (dashboard)

These cannot be set from code. In the Supabase dashboard, open the project, then:

1. **Authentication, URL Configuration.** Set **Site URL** to `https://register.nexuse.org`. Under **Redirect URLs**, add `https://nexux-e.vercel.app` (and `http://localhost:5173` while developing).
2. **Authentication, Sign In / Providers, Email.** Turn on **Prevent use of leaked passwords**. This needs the Pro plan. If the option is greyed out, it is the plan, not a setting you missed.
3. In the same place, turn **off** **Allow new users to sign up**, so only people you create can sign in.

## The flier QR code

`public/qr/nexus-e-flier-qr.svg` and `.png` encode `https://register.nexuse.org/?src=flier` (error correction H, 4 module quiet zone, dark green on white, no logo, 2000 px transparent PNG). The PNG is transparent, so print it on white or another light colour. Regenerate and re-verify with `npm run qr`, which decodes both files and fails if they do not read back correctly. The app ignores the `src` parameter, and a test keeps it that way.

## Checking the admin at phone width

Every admin screen is built to work at 360 px. To check after changes, sign in, open the browser at 360 px wide, and run the snippet in `scripts/phone-audit.js` in the console. It reports any sideways scroll and any tap target under 40 px.

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
