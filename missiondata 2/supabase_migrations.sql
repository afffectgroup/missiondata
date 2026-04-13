-- ================================================================
-- MISSION FREELANCES — Migrations v3.1
-- Appliquer dans Supabase → SQL Editor → New query
-- ================================================================

-- ── 1. Progression temps réel ──────────────────────────────────
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS generation_pct  int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_logs jsonb[] DEFAULT '{}';

-- Activer Realtime sur campaigns (nécessaire pour les subscriptions client)
ALTER publication supabase_realtime ADD TABLE public.campaigns;

-- ── 2. Kanban de suivi ──────────────────────────────────────────
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS kanban_status text DEFAULT NULL
    CHECK (kanban_status IN ('applied', 'followed_up', 'in_progress', 'signed')),
  ADD COLUMN IF NOT EXISTS kanban_notes  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kanban_updated_at timestamptz DEFAULT NULL;

-- Index pour filtrer par statut kanban rapidement
CREATE INDEX IF NOT EXISTS idx_prospects_kanban ON public.prospects(user_id, kanban_status)
  WHERE kanban_status IS NOT NULL;
