# SQL Migration — À exécuter dans Supabase SQL Editor

## Ajouter la colonne raw_data (optionnel, améliore enrichment emails)

```sql
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS raw_data jsonb;
```

Une fois cette colonne ajoutée, le pipeline stockera automatiquement le site web
de chaque contact pour permettre un meilleur taux d'email trouvé lors du re-enrichissement.

## Vérifier la structure actuelle

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'prospects' AND table_schema = 'public';
```
