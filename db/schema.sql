CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'staff', 'volunteer', 'viewer')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  other_names text,
  dob date,
  age integer,
  gender text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  country text DEFAULT 'Ghana',
  nationality text,
  id_type text,
  id_number text,
  emergency_name text,
  emergency_phone text,
  registration_source text,
  occupation text,
  reason_for_coming text,
  program_year integer NOT NULL DEFAULT (EXTRACT(YEAR FROM current_date))::int,
  registration_date date NOT NULL DEFAULT current_date,
  onboarding_status text NOT NULL DEFAULT 'registered'
    CHECK (onboarding_status IN ('registered', 'in_review', 'approved', 'onboarded', 'rejected')),
  onboarding_date date,
  notes text,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nhis_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  situation_case text,
  amount numeric(12,2),
  program_year integer NOT NULL DEFAULT (EXTRACT(YEAR FROM current_date))::int,
  registration_date date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT current_date,
  complaint text,
  diagnosis text,
  treatment text,
  provider_name text,
  outcome text,
  follow_up_date date,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_ip text,
  user_agent text
);

CREATE TABLE IF NOT EXISTS request_idempotency (
  scope text NOT NULL,
  client_request_id text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, client_request_id)
);

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS program_year integer;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS occupation text;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS reason_for_coming text;

UPDATE people
SET program_year = (EXTRACT(YEAR FROM current_date))::int
WHERE program_year IS NULL;

ALTER TABLE people
  ALTER COLUMN program_year SET DEFAULT (EXTRACT(YEAR FROM current_date))::int,
  ALTER COLUMN program_year SET NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_people_registration_date ON people (registration_date);
CREATE INDEX IF NOT EXISTS idx_people_onboarding_status ON people (onboarding_status);
CREATE INDEX IF NOT EXISTS idx_people_program_year_date ON people (program_year, registration_date);
CREATE INDEX IF NOT EXISTS idx_nhis_program_year_date ON nhis_registrations (program_year, registration_date);
CREATE INDEX IF NOT EXISTS idx_visits_person_date ON visits (person_id, visit_date);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_people_updated_at ON people;
CREATE TRIGGER trg_people_updated_at
BEFORE UPDATE ON people
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_nhis_registrations_updated_at ON nhis_registrations;
CREATE TRIGGER trg_nhis_registrations_updated_at
BEFORE UPDATE ON nhis_registrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
