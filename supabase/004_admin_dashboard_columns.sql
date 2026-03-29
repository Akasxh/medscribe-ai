-- Migration 004: Add columns for admin dashboard filtering and data completeness
-- Run this in Supabase SQL Editor

-- Add doctor_name, patient_name, cds_alerts, fhir_quality to consultations
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS doctor_name text DEFAULT '';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS patient_name text DEFAULT '';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS cds_alerts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS fhir_quality jsonb;

-- Indexes for admin dashboard filtering
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_name ON public.consultations (doctor_name);
CREATE INDEX IF NOT EXISTS idx_consultations_specialty ON public.consultations (specialty);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_name ON public.consultations (patient_name);
