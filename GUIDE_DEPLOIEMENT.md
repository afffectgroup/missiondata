# 🚀 Guide de déploiement — Mission Data v2
## Stack : Next.js · Supabase · Vercel

---

## Étape 1 — Créer le projet Supabase

1. Va sur **https://supabase.com** → "New project"
2. Choisis un nom (ex: `mission-data`), un mot de passe fort, région **EU West** (Frankfurt)
3. Attends ~2 minutes que le projet se crée
4. Va dans **SQL Editor** → "New query"
5. Copie-colle **tout le contenu** du fichier `supabase_schema.sql` et clique **Run**
6. Vérifie que toutes les tables sont créées : `profiles`, `campaigns`, `prospects`, `sequences`

---

## Étape 2 — Récupérer les clés Supabase

Dans ton projet Supabase → **Settings → API** :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" ⚠️ garder secret |

---

## Étape 3 — Créer ton compte admin dans Supabase

Dans Supabase → **Authentication → Users** → "Invite user" :
1. Entre ton email
2. Clique "Send invite" (ou "Create user")
3. Ensuite va dans **SQL Editor** et exécute :

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'TON_EMAIL_ICI';
```

> ⚠️ Sans ça, ton compte sera "freelance" et tu n'auras pas accès à l'admin.

---

## Étape 4 — Déployer sur Vercel

### Option A — Via GitHub (recommandé)

1. Push le dossier `mission-data-v2/` sur un repo GitHub (peut être privé)
2. Va sur **https://vercel.com** → "New Project" → importe le repo
3. Framework : **Next.js** (détecté automatiquement)
4. Clique **Deploy** (ça échouera car les env vars manquent — c'est normal)

### Option B — Via CLI Vercel

```bash
npm i -g vercel
cd mission-data-v2
vercel --prod
```

---

## Étape 5 — Configurer les variables d'environnement

Dans Vercel → ton projet → **Settings → Environment Variables**, ajoute :

| Nom | Valeur | Environnements |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase | Production, Preview, Dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon | Production, Preview, Dev |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role | Production, Preview, Dev |
| `ICYPEAS_API_KEY` | Ta clé Icypeas | Production, Preview, Dev |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview, Dev |

Puis : **Deployments → "Redeploy"** (dernier déploiement) pour appliquer les variables.

---

## Étape 6 — Vérifier le déploiement

1. Ouvre l'URL Vercel (ex: `https://mission-data-xxx.vercel.app`)
2. Tu dois voir la page de **connexion Mission Data**
3. Connecte-toi avec ton email admin
4. Tu dois arriver sur le **tableau de bord admin**

Si tu vois une erreur blanche → va dans Vercel → **Functions** pour voir les logs.

---

## Étape 7 — Créer les premiers comptes freelances

Dans l'espace admin → onglet **Freelances** → "Créer un compte" :
- Entre le nom, l'email et le mot de passe
- Le compte est immédiatement actif
- Donne les identifiants au freelance

---

## Optionnel — Domaine personnalisé

Dans Vercel → Settings → Domains → ajoute `data.mission-freelances.com`

Puis dans ton registrar DNS, ajoute :
```
CNAME  data  cname.vercel-dns.com
```

---

## Structure des fichiers

```
mission-data-v2/
├── pages/
│   ├── index.js                    → redirect intelligent (login/admin/app)
│   ├── login.js                    → page de connexion
│   ├── _app.js                     → context auth global
│   ├── admin/
│   │   └── index.js                → espace admin (stats + gestion users)
│   ├── app/
│   │   ├── index.js                → espace freelance (liste dossiers)
│   │   └── campaign/[id].js        → dossier détail (mirroring→prospects→séquences)
│   └── api/
│       ├── admin/
│       │   ├── stats.js            → stats globales
│       │   ├── users.js            → list + create
│       │   └── users/[id].js       → edit + delete + toggle
│       ├── campaigns/
│       │   ├── index.js            → list + create
│       │   ├── [id].js             → get + update + delete
│       │   └── mirror.js           → mirroring IA (Claude)
│       ├── prospects/
│       │   └── search.js           → Icypeas search + save
│       └── sequences/
│           ├── generate.js         → génération IA (Claude) × tous les prospects
│           └── [id].js             → edit une séquence
├── lib/
│   ├── supabase.js                 → clients Supabase (browser + admin)
│   └── auth.js                    → middleware requireAuth / requireAdmin
├── styles/
│   └── globals.css                 → design tokens + composants
├── supabase_schema.sql             → schéma BDD complet + RLS
├── .env.example                    → variables requises
├── next.config.js
└── package.json
```

---

## Sécurité — Points importants

- **Row Level Security (RLS)** activé sur toutes les tables → chaque freelance ne voit que ses données, garanti côté base
- **`SUPABASE_SERVICE_ROLE_KEY`** n'est utilisé que côté serveur (API routes) — jamais exposé au browser
- **`ANTHROPIC_API_KEY`** et **`ICYPEAS_API_KEY`** idem — uniquement serveur
- L'admin est identifié par `role = 'admin'` dans la table `profiles` — impossible à contourner côté client

---

## Support

Pour toute question : contact@mission-freelances.com
