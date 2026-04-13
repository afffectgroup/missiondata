-- ================================================================
-- MISSION DATA — Migration v2
-- Ajouter colonnes pour le nouveau wizard APE/dept/effectif
-- ================================================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ape_code       text,
  ADD COLUMN IF NOT EXISTS ape_label      text,
  ADD COLUMN IF NOT EXISTS departement    text,
  ADD COLUMN IF NOT EXISTS dept_label     text,
  ADD COLUMN IF NOT EXISTS effectif_code  text,
  ADD COLUMN IF NOT EXISTS effectif_label text,
  ADD COLUMN IF NOT EXISTS job_titles     text,
  ADD COLUMN IF NOT EXISTS n_companies    int DEFAULT 10;

-- Renommer le champ "name" garde sa valeur — on s'en sert pour le nom de la base
-- Les anciens champs client_type/sector/etc. restent (backward compat) mais
-- les nouvelles bases utilisent les nouveaux champs.
