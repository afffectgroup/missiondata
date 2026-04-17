# Migration SQL — À exécuter dans Supabase SQL Editor

```sql
-- Historique des recherches d'emails (feature "Trouver un email")
CREATE TABLE IF NOT EXISTS public.email_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firstname TEXT,
  lastname TEXT,
  domain_or_company TEXT NOT NULL,
  email_found TEXT,
  certainty TEXT,
  mx_provider TEXT,
  status TEXT, -- 'FOUND' | 'NOT_FOUND' | 'ERROR'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_searches" ON public.email_searches
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_searches_user_date
  ON public.email_searches(user_id, created_at DESC);
```
