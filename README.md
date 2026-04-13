# Mission Freelances — Plateforme v3.0

Outil de prospection B2B pour freelances : définissez votre client idéal, trouvez vos prospects via Icypeas, recevez des séquences email/LinkedIn personnalisées par Claude.

## Stack

- **Next.js 14** (Pages Router)
- **Supabase** (auth + PostgreSQL + RLS)
- **Icypeas** (enrichissement prospects)
- **Anthropic Claude Sonnet** (génération de séquences)
- **Vercel** (déploiement recommandé)

## Structure

```
pages/
  index.js                          → Login / inscription
  dashboard.js                      → Liste des campagnes
  nouvelle-campagne.js              → Wizard création (3 étapes)
  prospects.js                      → Vue globale prospects
  sequences.js                      → Vue globale séquences
  campagnes/[id].js                 → Détail campagne (prospects + séquences)
  api/
    auth/callback.js                → Auth callback Supabase
    campaigns/
      index.js                      → GET /POST campagnes
      [id].js                       → GET/PUT/DELETE campagne
      [id]/generate-prospects.js    → POST → Icypeas find people + email search
      [id]/generate-sequences.js    → POST → Claude sequences

components/
  Layout.js                         → Sidebar nav + header

lib/
  supabase.js                       → Client browser
  supabaseAdmin.js                  → Client serveur (service role)
  icypeas.js                        → Find People, bulk email search
  claude.js                         → generateProspectQuery, generateSequence

styles/
  globals.css                       → Design tokens Mission Freelances v1.1

supabase_schema.sql                 → Schéma complet avec RLS, triggers, indexes
```

## Installation locale

```bash
git clone https://github.com/afffectgroup/missiondata
cd missiondata
npm install
cp .env.example .env.local
# Remplir .env.local avec vos clés
npm run dev
```

## Variables d'environnement

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `ICYPEAS_API_KEY` | app.icypeas.com → Settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

## Setup Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor → New query**
3. Coller le contenu de `supabase_schema.sql` et exécuter
4. Aller dans **Authentication → URL Configuration** :
   - Site URL : `https://votre-domaine.vercel.app`
   - Redirect URLs : `https://votre-domaine.vercel.app/api/auth/callback`

## Déploiement Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

Configurer les variables d'environnement dans **Vercel → Settings → Environment Variables**.

## Flux utilisateur

```
1. Inscription / connexion
2. Créer une campagne (wizard 3 étapes)
   → Profil client cible (type, secteur, taille, localisation, besoin)
   → Valeur freelance (résultat, KPI, angle, ton)
   → Récapitulatif + création
3. Dans la campagne → "Trouver des prospects"
   → Claude génère une requête Icypeas
   → Icypeas Find People retourne des profils
   → Icypeas Bulk Email Search enrichit les emails
   → Résultats sauvegardés dans Supabase
4. "Générer les séquences"
   → Claude génère 3 emails + 2 messages LinkedIn par prospect
   → Séquences éditables et copiables
5. Export CSV depuis la page Prospects
```

## Crédits Icypeas consommés par pipeline

| Action | Coût |
|---|---|
| `find-people` (20 profils) | ~20 crédits |
| `bulk-email-search` (20 emails) | ~20 crédits |
| Total par campagne (20 prospects) | ~40 crédits |

Tester avec `maxResults: 5` en dev pour économiser les crédits.

## Notes importantes

- Le service role Supabase contourne le RLS → **ne jamais l'exposer côté client**
- Les routes `/api/campaigns/[id]/generate-*` peuvent prendre 30–60s (Icypeas async + Claude) → prévoir un timeout Vercel de 60s (plan Pro)
- Pour les séquences, Claude génère en batches de 3 prospects pour éviter les rate limits Anthropic

## Roadmap

- [ ] Export XLSX (SheetJS)
- [ ] Dashboard stats (taux de réponse, candidatures)
- [ ] Intégration webhook Lemlist / Instantly
- [ ] CRM contacts avec historique interactions
- [ ] Mode équipe (partage de campagnes entre freelances)
