-- Allow anonymous sessions: make doctor_id nullable across all tables
ALTER TABLE public.consultations ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE public.clinical_notes ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE public.fhir_bundles ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE public.prescriptions ALTER COLUMN doctor_id DROP NOT NULL;
