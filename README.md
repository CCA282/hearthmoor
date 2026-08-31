# 🏚️ Hearthmoor

Jeu d'aventure/survie coopératif en 3D low-poly, ambiance viking/nordique — un
camp de base entouré de zones de plus en plus hostiles (Prairie, Forêt sombre,
Marais, Montagne), combat, artisanat et progression d'équipement.

Voir `docs/spec.md` pour la spec produit complète et `docs/hamnet-village-tech-foundation.md`
pour les patterns techniques hérités de [`hamnet-village`](https://github.com/CCA282/hamnet-village).

**Statut du projet** : socle en cours de construction — déplacement du personnage,
caméra semi-isométrique, connexion en room (sans synchronisation d'état pour
l'instant). Voir `CLAUDE.md` pour l'état d'avancement détaillé.

## Lancer le jeu

```bash
npm install
npm run dev
```

Ouvre [http://localhost:5173](http://localhost:5173) dans le navigateur.

## Comment jouer (pour l'instant)

- **Clavier** : WASD pour se déplacer
- **Manette** : stick gauche ou croix directionnelle pour se déplacer

La caméra suit le personnage, à angle fixe (semi-isométrique).

## Stack technique

- Vue 3 + Vite
- Rendu 3D low-poly via [Three.js](https://threejs.org) — caméra orthographique
  fixe, éclairage simple, brouillard de scène
- Aucun backend custom : le mode local ne dépend de rien, et le mode en ligne
  parle directement à [Supabase](https://supabase.com) — Realtime (Broadcast +
  Presence) relaie les rooms, Postgres stockera les sauvegardes une fois le
  modèle de monde défini. Même principe que `hamnet-village`, voir ci-dessous.

## Build production

```bash
npm run build    # → dist/
npm run preview  # prévisualiser le build
```

## Déploiement (GitHub Pages)

Chaque push sur `main` déclenche `.github/workflows/pages-deploy.yml` : build
(`npm run build`, avec `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` injectées
depuis les variables de repo GitHub `vars.SUPABASE_URL`/`vars.SUPABASE_ANON_KEY`)
puis publication de `dist/` sur GitHub Pages : https://cca282.github.io/hearthmoor/

Le frontend est 100% statique — GitHub Pages sert `dist/` tel quel.

## Comptes, multijoueur en ligne et sauvegardes

Tout passe par [Supabase](https://supabase.com) — **même projet que
`hamnet-village`/`cine-planner`** (identité partagée), pas de backend custom :

- **Auth** : email + mot de passe via Supabase Auth (`src/net/accounts.js`).
- **Relay temps réel** (rooms host/guest) : un channel Supabase Realtime par room
  (`hearthmoor:room:<CODE>`), Broadcast pour l'état du monde/inputs, Presence pour
  savoir qui est host/guest et détecter les join/leave — voir `src/net/realtime.js`.
  ⚠️ La room se crée/rejoint réellement, mais l'état de la scène n'est pas encore
  synchronisé entre joueurs (voir `CLAUDE.md`).
- **Sauvegardes** (prévu) : table Postgres `hearthmoor_worlds`, RLS'd sur
  `auth.uid()` — voir `src/net/sync.js`. Le format exact du snapshot sauvegardé
  arrivera avec le modèle de monde (zones, inventaire...).

### Configuration Supabase requise

En plus du projet Auth déjà configuré (partagé avec `hamnet-village`), créer la
table `hearthmoor_worlds` dans le SQL Editor du projet :

```sql
create table hearthmoor_worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index hearthmoor_worlds_owner_saved_idx on hearthmoor_worlds (owner_id, saved_at desc);
alter table hearthmoor_worlds enable row level security;
create policy "own rows" on hearthmoor_worlds for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on table hearthmoor_worlds to authenticated;
```

`hearthmoor_` préfixe le nom de la table à dessein : le projet Supabase est
partagé entre plusieurs jeux, chaque jeu doit préfixer ses propres objets
(tables, topics Realtime) pour ne pas collisionner avec les autres.

### Frontend

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (variables d'env au build)
  pointent vers le projet Supabase. Sans elles, l'app reste jouable mais sans
  compte ni multijoueur en ligne (mode local uniquement) — voir `src/net/supabase.js`.
- La session est gérée par `@supabase/supabase-js` (persistée en `localStorage`
  par le SDK) ; `netState.user` suit `supabase.auth.onAuthStateChange`.

## Tests

```bash
npm run lint      # eslint src/
npm run test      # vitest — logique pure + net/ (mocks localStorage/Supabase)
npm run test:e2e  # playwright — vrai navigateur, aucun réseau Supabase réel
```

Voir `docs/hamnet-village-tech-foundation.md` §12 pour la stratégie de mock
détaillée (hook `window.__HEARTHMOOR_REALTIME_TEST_HOOK__` pour ne jamais
toucher Supabase Realtime en CI).
