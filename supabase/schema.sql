-- MedScribe AI — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('doctor', 'admin', 'nurse');
create type public.session_status as enum ('active', 'completed');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        public.app_role not null default 'doctor',
  hospital    text,
  specialty   text,
  registration_number text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- PATIENTS
-- ============================================================
create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.profiles(id) on delete cascade,
  name        text,
  age         smallint,
  gender      text,
  abha_id     text,
  phone       text,
  created_at  timestamptz not null default now()
);
create index patients_doctor_id_idx on public.patients(doctor_id);

-- ============================================================
-- CONSULTATIONS
-- ============================================================
create table public.consultations (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.profiles(id) on delete cascade,
  patient_id    uuid references public.patients(id) on delete set null,
  status        public.session_status not null default 'active',
  specialty     text not null default 'general',
  transcript    text not null default '',
  abha_id       text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index consultations_doctor_id_idx on public.consultations(doctor_id);
create index consultations_status_idx on public.consultations(status);
create index consultations_started_at_idx on public.consultations(started_at desc);

-- ============================================================
-- CLINICAL NOTES (JSONB for nested structures)
-- ============================================================
create table public.clinical_notes (
  id                          uuid primary key default gen_random_uuid(),
  consultation_id             uuid not null unique references public.consultations(id) on delete cascade,
  doctor_id                   uuid not null references public.profiles(id) on delete cascade,
  patient_info                jsonb not null default '{}',
  chief_complaint             text,
  history_of_present_illness  text,
  symptoms                    jsonb not null default '[]',
  vitals                      jsonb not null default '{}',
  diagnosis                   jsonb not null default '[]',
  medications                 jsonb not null default '[]',
  observations                jsonb not null default '[]',
  allergies                   jsonb not null default '[]',
  differential_diagnosis      jsonb not null default '[]',
  risk_factors                jsonb not null default '[]',
  recommended_tests           jsonb not null default '[]',
  follow_up                   text,
  clinical_notes_text         text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index clinical_notes_doctor_id_idx on public.clinical_notes(doctor_id);
create index clinical_notes_diagnosis_gin on public.clinical_notes using gin(diagnosis);

-- ============================================================
-- FHIR BUNDLES
-- ============================================================
create table public.fhir_bundles (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations(id) on delete cascade,
  doctor_id       uuid not null references public.profiles(id) on delete cascade,
  bundle          jsonb not null,
  quality_score   smallint,
  quality_grade   char(1),
  fhir_version    text not null default 'R4',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index fhir_bundles_bundle_gin on public.fhir_bundles using gin(bundle jsonb_path_ops);
create index fhir_bundles_doctor_id_idx on public.fhir_bundles(doctor_id);

-- ============================================================
-- PRESCRIPTIONS (denormalized for fast queries)
-- ============================================================
create table public.prescriptions (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  doctor_id       uuid not null references public.profiles(id) on delete cascade,
  patient_id      uuid references public.patients(id) on delete set null,
  medication_name text not null,
  generic_name    text,
  dosage          text,
  frequency       text,
  duration        text,
  route           text default 'oral',
  rxnorm_code     text,
  created_at      timestamptz not null default now()
);
create index prescriptions_consultation_id_idx on public.prescriptions(consultation_id);
create index prescriptions_doctor_id_idx on public.prescriptions(doctor_id);

-- ============================================================
-- CORRECTIONS (continuous learning)
-- ============================================================
create table public.corrections (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  doctor_id       uuid not null references public.profiles(id) on delete cascade,
  transcript      text,
  original_note   jsonb not null,
  corrected_note  jsonb not null,
  field_path      text not null,
  applied_count   int not null default 0,
  created_at      timestamptz not null default now()
);
create index corrections_doctor_id_idx on public.corrections(doctor_id);

-- ============================================================
-- CDS ALERTS (per consultation)
-- ============================================================
create table public.cds_alerts (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  alert_type      text not null,
  severity        text not null default 'warning',
  title           text not null,
  description     text,
  created_at      timestamptz not null default now()
);
create index cds_alerts_consultation_id_idx on public.cds_alerts(consultation_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_clinical_notes_updated_at
  before update on public.clinical_notes
  for each row execute function public.set_updated_at();

create trigger set_fhir_bundles_updated_at
  before update on public.fhir_bundles
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTH: Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      (new.raw_user_meta_data ->> 'role')::public.app_role,
      'doctor'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.consultations enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.fhir_bundles enable row level security;
alter table public.prescriptions enable row level security;
alter table public.corrections enable row level security;
alter table public.cds_alerts enable row level security;

-- Helper: get role from JWT
create or replace function public.current_user_role()
returns text language sql stable security definer
set search_path = '' as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''),
    'doctor'
  )
$$;

-- Profiles: own data + admin sees all
create policy "own_profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "update_own_profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- All clinical tables: doctor sees own, admin sees all
create policy "doctor_consultations" on public.consultations for all to authenticated
  using (doctor_id = auth.uid() or public.current_user_role() = 'admin')
  with check (doctor_id = auth.uid());

create policy "doctor_clinical_notes" on public.clinical_notes for all to authenticated
  using (doctor_id = auth.uid() or public.current_user_role() = 'admin')
  with check (doctor_id = auth.uid());

create policy "doctor_fhir_bundles" on public.fhir_bundles for all to authenticated
  using (doctor_id = auth.uid() or public.current_user_role() = 'admin')
  with check (doctor_id = auth.uid());

create policy "doctor_patients" on public.patients for all to authenticated
  using (doctor_id = auth.uid() or public.current_user_role() = 'admin')
  with check (doctor_id = auth.uid());

create policy "doctor_prescriptions" on public.prescriptions for all to authenticated
  using (doctor_id = auth.uid() or public.current_user_role() = 'admin')
  with check (doctor_id = auth.uid());

create policy "doctor_corrections" on public.corrections for all to authenticated
  using (doctor_id = auth.uid() or public.current_user_role() = 'admin')
  with check (doctor_id = auth.uid());

create policy "doctor_cds_alerts" on public.cds_alerts for all to authenticated
  using (
    consultation_id in (
      select id from public.consultations where doctor_id = auth.uid()
    )
    or public.current_user_role() = 'admin'
  );

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.consultations;
alter publication supabase_realtime add table public.clinical_notes;
alter publication supabase_realtime add table public.fhir_bundles;
