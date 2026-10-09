# NEXUS-E site audit, 9 October 2026

Scope: the live site (register.nexuse.org) after the Africa-wide and language release, and the production database
(`bkbkrjgkannexiwuslyu`). Read-only on production. No registrations were made there.

## Production state
- Experts: 0. The Expert ID sequence has never been used (`last_value` 1, `is_called` false), so the next ID is **NEX-000001**.

## How it was checked
- Every public route (home, register, registered, verify, verify dashboard, directory, directory with a country filter,
  a profile, a missing page) in English, French and Portuguese, at 360 px and 1280 px: console errors, failed requests,
  horizontal overflow, headings, `lang`, image alt text, unnamed buttons and links, touch target size, untranslated text.
- Lighthouse on the live register page (mobile): performance 99, accessibility 100, best practices 100, SEO 100.
- Security response headers, route status codes, robots.txt, `npm audit`.
- Supabase security and performance advisors on production.

## Errors found and fixed
| # | Finding | Fix |
|---|---------|-----|
| 1 | Portuguese directory page overflowed a 360 px screen by 27 px (the sort control with the longer Portuguese option). | Sort control can shrink; deployed and re-checked on live. |
| 2 | Registration page weight grew when the English dictionary joined the main bundle (mobile Lighthouse 99 to 97). | English split into a core and a site part loaded by the pages that need it; Verify pages made lazy. Back to 99. |

No console errors, failed requests, missing alt text, unnamed controls, untranslated text or wrong `lang` on any route.
The one "small touch target" the crawl reported is the hidden honeypot input, which is off screen on purpose.

## Left for you or for later
| # | Finding | Why it is left | Suggested action |
|---|---------|----------------|------------------|
| 1 | Supabase Auth: leaked password protection is off (advisor warning). | It is a dashboard setting; it only affects admin sign-in. | Turn it on in Auth, Passwords. |
| 2 | Unknown addresses (and `/sitemap.xml`, which does not exist) answer HTTP 200 with the app page. | Single page app behaviour. The 404 page itself shows correctly and is marked noindex. | Add a real `sitemap.xml`; optionally a Vercel rule so unknown paths return 404. |
| 3 | Advisor: 8 tables with row security on and no policy. | Intentional. These tables are only reached through the guarded functions. | None. |
| 4 | Advisor: public (anonymous) can run `register_expert`, `directory_search`, `directory_profile`; signed-in users can run the `admin_*` functions. | Intentional for the first three. The `admin_*` functions check `is_admin()` themselves. | Optionally revoke `authenticated` execute on `register_expert` and the directory functions. |
| 5 | Advisor: 6 unused indexes. | The table is empty. | Re-check after real traffic. |
| 6 | No Content-Security-Policy header. Other security headers are present (HSTS, nosniff, frame deny, referrer, permissions). | Needs careful testing against fonts and the Supabase endpoints. | Add in report-only mode first. |
| 7 | Verification dashboard shows "Not provided" for Country. | The expert-portal Edge Function does not return the country yet. | Redeploy the function with `country` in its select list. |
| 8 | Emails are English only. | Needs a language stored per expert. | Separate change. |
| 9 | DMARC record, bare domain `nexuse.org` serves no site, Resend free plan limit of 100 emails a day, QR file choices. | Outside the code. | As raised earlier. |
| 10 | French and Portuguese wording needs native review (privacy and verification text first). | Translations were written from the English source. | See the release notes. |
