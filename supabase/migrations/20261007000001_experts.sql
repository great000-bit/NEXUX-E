-- NEXUS-E Phase 1: experts table, Expert ID sequence and constraints.

create sequence if not exists public.expert_id_seq start with 1 increment by 1 minvalue 1;

create table public.experts (
  id uuid primary key default gen_random_uuid(),
  expert_id text not null unique
    default ('NEX-' || lpad(nextval('public.expert_id_seq')::text, 6, '0')),

  -- Screen 1: identity
  full_name text not null,
  title text not null,
  organisation text not null,
  position text not null,
  state text not null,
  phone text,
  email text,

  -- Screen 2: expertise
  primary_expertise text not null,
  secondary_expertise text[] not null default '{}',
  years_experience text not null,
  qualification text not null,
  memberships text[] not null default '{}',
  nes_number text,
  iepn_status text,

  -- Screen 3: opportunity profile and consent
  assignments text[] not null default '{}',
  availability text not null,
  profile_url text,
  discoverable boolean not null,
  consent_contact boolean not null,
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-10',

  -- Phase 2 placeholder, kept here so the schema does not need reshaping later
  verification_status text not null default 'pending',

  source text not null default 'web',
  created_at timestamptz not null default now(),

  constraint experts_contact_present check (phone is not null or email is not null),
  constraint experts_secondary_max3 check (cardinality(secondary_expertise) <= 3),
  constraint experts_consent_contact_true check (consent_contact is true),
  constraint experts_title_valid check (title in ('Prof','Dr','Engr','Arc','Tpl','Mr','Mrs','Ms','Other')),
  constraint experts_years_valid check (years_experience in ('Under 5','5 to 10','11 to 20','21 to 30','30+')),
  constraint experts_availability_valid check (availability in ('State only','Nigeria','West Africa','Africa','International')),
  constraint experts_verification_valid check (verification_status in ('pending','verified','not_verified'))
);

-- Duplicates are blocked by email and by phone number (stored normalised).
create unique index experts_email_key on public.experts (lower(email)) where email is not null;
create unique index experts_phone_key on public.experts (phone) where phone is not null;

create index experts_created_at_idx on public.experts (created_at desc);
create index experts_primary_expertise_idx on public.experts (primary_expertise);
create index experts_state_idx on public.experts (state);

-- Hook for the confirmation email (not sent in this pass).
-- register_expert() queues one row per registrant. A later Edge Function or
-- scheduled job reads status = 'pending', sends the email and marks it 'sent'.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  expert_id text not null references public.experts (expert_id) on delete cascade,
  to_email text not null,
  template text not null default 'registration_confirmation',
  status text not null default 'pending',
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_outbox_status_valid check (status in ('pending','sent','failed'))
);

-- Admin allow-list. Being signed in is not enough to read data: the email must be listed here.
create table public.admins (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admins_email_lower check (email = lower(email))
);

-- Lightweight per-network rate limiting for the public RPC.
create table public.registration_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);
create index registration_attempts_lookup_idx on public.registration_attempts (client_key, created_at desc);
