create table if not exists users (
  id text primary key,
  email text unique,
  privy_user_id text not null unique,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case users table already existed with not null email
alter table if exists users alter column email drop not null;

create table if not exists organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agents (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  name text not null,
  scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists spaces (
  id text primary key,
  type text not null check (type in ('personal', 'shared')),
  name text not null,
  owner_user_id text not null references users(id) on delete cascade,
  status text not null check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists spaces_personal_owner_idx
  on spaces(owner_user_id)
  where type = 'personal';

create index if not exists spaces_owner_idx on spaces(owner_user_id);

create table if not exists space_memberships (
  space_id text not null references spaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'member', 'viewer')),
  status text not null check (status in ('active', 'invited', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists space_memberships_user_idx on space_memberships(user_id);

create table if not exists wallet_link_challenges (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  space_id text not null,
  address text not null,
  nonce text not null,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wallet_link_challenges_user_idx on wallet_link_challenges(user_id);

create table if not exists wallets (
  id text primary key,
  owner_type text not null check (owner_type in ('user', 'agent', 'organization', 'external')),
  owner_id text,
  chain text not null,
  address text not null unique,
  provider text not null,
  kind text not null,
  verification text not null default 'provider_attested',
  status text not null default 'active',
  space_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists wallets add column if not exists verification text not null default 'provider_attested';
alter table if exists wallets add column if not exists status text not null default 'active';
alter table if exists wallets add column if not exists space_id text;

create table if not exists recipients (
  id text primary key,
  lookup_key text not null unique,
  owner_type text not null check (owner_type in ('user', 'agent', 'organization', 'external')),
  owner_id text,
  wallet_address text,
  claim_status text not null check (claim_status in ('claimed', 'pending-claim')),
  space_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists recipients add column if not exists space_id text;

create table if not exists envelopes (
  id text primary key,
  space_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists envelopes add column if not exists space_id text;

create table if not exists intents (
  id text primary key,
  envelope_id text not null,
  recipient_id text not null,
  status text not null check (status in ('approved', 'rejected')),
  space_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists intents add column if not exists space_id text;

create table if not exists payments (
  id text primary key,
  intent_id text not null,
  recipient_id text not null,
  status text not null,
  tx_hash text,
  space_id text,
  payment_data jsonb not null,
  settlement_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists payments add column if not exists tx_hash text;
alter table if exists payments add column if not exists space_id text;
alter table if exists payments drop constraint if exists payments_status_check;

create unique index if not exists payments_tx_hash_idx on payments(tx_hash) where tx_hash is not null;

create table if not exists settlements (
  id text primary key,
  payment_id text not null,
  status text not null check (status in ('planned', 'settled', 'claimed')),
  mode text not null check (mode in ('direct', 'claimable')),
  chain text not null check (chain in ('arc')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id text primary key,
  account_id text not null,
  entry_type text not null,
  reference_type text not null,
  reference_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  actor_type text not null,
  actor_id text not null,
  event_type text not null,
  object_type text not null,
  object_id text not null,
  space_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists audit_events add column if not exists space_id text;

create table if not exists worker_jobs (
  id text primary key,
  job_type text not null,
  payment_id text not null,
  settlement_id text not null,
  status text not null check (status in ('queued', 'processing', 'completed')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  type text not null,
  channel text not null check (channel in ('email', 'xmtp', 'webhook')),
  recipient text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipients_owner_idx on recipients(owner_type, owner_id);
create index if not exists wallets_owner_idx on wallets(owner_type, owner_id);
create index if not exists intents_envelope_idx on intents(envelope_id);
create index if not exists intents_recipient_idx on intents(recipient_id);
create index if not exists payments_intent_idx on payments(intent_id);
create index if not exists payments_recipient_idx on payments(recipient_id);
create index if not exists settlements_payment_idx on settlements(payment_id);
create index if not exists ledger_entries_account_idx on ledger_entries(account_id);
create index if not exists audit_events_object_idx on audit_events(object_type, object_id);
create index if not exists worker_jobs_payment_idx on worker_jobs(payment_id);
create index if not exists notifications_recipient_idx on notifications(recipient);
