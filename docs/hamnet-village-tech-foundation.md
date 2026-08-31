# Fondation technique — extraite de Petit Hameau (hamnet-village)

> Document de référence, pas une spec produit. Objectif : servir de socle technique
> pour écrire la spec du **prochain jeu** (working title interne : "nouveau jeu",
> `dev/games/<nouveau-dossier>`), qui reprend la même stack et le même modèle de
> déploiement que `hamnet-village`, mais avec une ambition de contenu bien plus
> large (façon Stardew Valley + combat + crafting/armure façon Minecraft).
>
> Généré le 2026-08-29 à partir de l'état du repo `hamnet-village` (branche `main`).

---

## 1. Résumé du stack

| Couche | Choix | Notes |
|---|---|---|
| Framework UI | Vue 3 (`<script setup>`, Composition API) | `reactive()` pour l'état partagé, pas de Pinia/Vuex |
| Build | Vite 6 | `base` dynamique (`/` en dev, `/<repo>/` en build — voir §12) |
| Rendu jeu | `<canvas>` 2D, pixel-art, aucun framework de jeu | Moteur maison, boucle RAF ~60 fps |
| Backend | **Aucun** — 100 % Supabase | Auth + Postgres + Realtime, projet **partagé** entre jeux |
| Hébergement | GitHub Pages (statique) | Déployé via GitHub Actions sur push `main` |
| Tests unitaires | Vitest | Environnement `node`, pas de DOM — mocks pour tout ce qui touche au navigateur |
| Tests e2e | Playwright | Vrai navigateur, dev server réel, **aucun réseau Supabase réel** (voir §13) |
| Lint | ESLint 9 (flat config) + `eslint-plugin-vue` | |

Dépendances runtime : uniquement `vue` et `@supabase/supabase-js`. Volontairement minimal — pas de router, pas de state manager dédié, pas de moteur physique.

---

## 2. Arborescence type

```
src/
  App.vue                    # racine : <GameCanvas> + overlays Vue (Hud, menus…)
  main.js
  style.css

  game/
    engine.js                # Singleton : boucle RAF, resize canvas, dispatch input↔world
    store.js                 # game = reactive({...}) — SEUL état Vue-réactif + fonctions d'achat/craft/etc.
    audio.js                 # musique de fond (Audio API), réglages persistés en localStorage

    constants/                # Toutes les données de jeu (tuning), zéro logique
      <domaine>.js            # ex: buildings.js, upgrades/*.js, gameplay.js, camera.js, layout/*.js
      index.js                # ré-export centralisé

    input/
      keyboard.js              # 2 schémas clavier (P1/P2) + touches d'action/annulation
      gamepad.js                # Gamepad API, edge-detection (pressed && !prev)
      touch.js                  # joystick virtuel + bouton action
      index.js                  # Input class : agrège les 4 sources, expose *State()/*Pressed()

    sprites/
      palette.js                 # couleurs nommées
      defs/<domaine>.js          # grilles pixel-art ASCII + palette locale → { rows, pal }
      index.js                   # sprite(name)/spriteUrl(name) : build → <canvas> offscreen, caché en Map

    world/
      World.js                   # class World — constructor + update(dt,input) + render(ctx), shell minimal
      <domaine>.js                # ex: players.js, actions.js, buildings.js, menu.js, camera.js, particles.js…
                                   # chaque fichier exporte un objet de méthodes "mixé" sur World.prototype
      renderer/                   # dessin pur, découpé par souci de lisibilité (entities, effects, helpers…)

  net/
    supabase.js                 # createClient() unique, fallback "not-configured" si env manquantes
    accounts.js                 # signup/login/logout — wrapper fin sur supabase.auth.*
    netState.js                 # état réseau non-canvas (mode local/host/guest, user, room code…)
    realtime.js                 # SEUL fichier qui touche supabase.channel() — rooms, presence, broadcast
    sync.js                     # serializeWorld/applyWorldState (monde ↔ JSON) + save/load (local ou Postgres)

  components/                  # UI Vue par-dessus le canvas (menus, HUD, lobby, modales…)

  tests/                        # Vitest — logique pure + net/*, mocks vue/netState/supabase

e2e/                            # Playwright — specs par domaine fonctionnel (solo, gamepad, online-coop…)
  helpers.js                    # utilitaires communs (ex: startLocalGame)
```

**Règle de nommage clé** : un fichier `constants/*` ne contient **que** des données
(pas de fonction avec effet de bord). Toute la logique vit dans `world/*` ou `store.js`.

---

## 3. Les deux couches de rendu

```
Input (clavier/manette/tactile/souris)
  → engine.js (boucle RAF)
    → World.update(dt, input)   ← toute la logique de jeu
    → World.render(ctx)         ← tout le dessin canvas
  → game (Vue reactive)         ← état partagé pour l'UI (store.js)
    → Hud.vue, VillageMenu.vue, …
```

- **Canvas** (`GameCanvas.vue` → `engine.js` → `World`) : le monde du jeu, objets JS
  **non-réactifs** exprès (perf — un jeu à 60 fps avec des dizaines d'entités ne doit
  pas déclencher le reactivity tracking de Vue à chaque frame).
- **UI Vue** (`Hud.vue`, menus, modales) : lit `game` (le seul objet `reactive()`),
  re-render seulement quand cet état change.

`game` est donc le point de jonction unique entre les deux mondes. Toute donnée qui
doit s'afficher dans l'UI Vue (ressources, joueurs, état de menu…) doit avoir un
miroir dans `game`. Tout le reste (positions, timers de croissance, IA des PNJ…)
reste dans `World` en JS pur.

⚠️ **Piège vécu** (voir §15) : si une donnée de gameplay n'existe que dans `World`
(jamais copiée dans `game`), elle est invisible pour la sauvegarde à moins d'être
explicitement ajoutée à `serializeWorld`/`applyWorldState` — les deux doivent
systématiquement évoluer ensemble.

---

## 4. `World` : pattern de composition par mixins

`World` est une classe "coquille" : constructeur (état initial) + `update()` +
`render()`. Tout le reste du comportement est ajouté via des modules qui exportent
un objet de méthodes utilisant `this` normalement, mixés en une passe à la fin de
`World.js` :

```js
Object.assign(World.prototype, playersMethods, menuMethods, actionsMethods, /* … */)
```

Avantages observés sur `hamnet-village` : chaque fichier reste petit et testable
isolément (voir §13 — les tests instancient un faux contexte `{ ...playerMethods, players: [], … }`
sans passer par `new World()`). Inconvénient : pas de vérification de type sur les
champs attendus par chaque mixin (à documenter si le nouveau jeu grossit beaucoup).

**Pour un jeu plus ambitieux** (combat, craft, plus d'entités), ce pattern tient
la route tant que le nombre de mixins reste raisonnable (~10-15). Au-delà, envisager
une vraie séparation en systèmes (ECS léger) plutôt que d'empiler les mixins — à
trancher dans la spec du nouveau jeu selon la taille de la boucle de gameplay prévue.

---

## 5. Systèmes de coordonnées

- **World space** : `WORLD_W × WORLD_H` px (1000×620 ici) — toute la logique de jeu.
- **Viewport** : résolution logique basse (480×270 ici) — la caméra mappe world→viewport.
- **Canvas** : pixels physiques = taille CSS × `devicePixelRatio`, géré par `engine.js`
  au resize (`imageSmoothingEnabled = false` partout pour garder le pixel-art net).

Ce triple système permet une résolution logique fixe et cohérente (facilite le
pixel-art et le placement des sprites) indépendamment de la taille réelle de la
fenêtre/l'écran.

---

## 6. Sprites : pixel-art généré, pas d'assets binaires

Aucune image externe. Chaque sprite est une grille ASCII + une palette de caractères :

```js
{ rows: ['.HHHHHH.', 'HHHHHHHH', …], pal: { H: '#3a2a12', … } }
```

`sprite(name)` construit un `<canvas>` offscreen pixel par pixel au premier appel et
le cache dans une `Map` (`sprites/index.js`). `spriteUrl(name)` exporte en data-URL
PNG pour les `<img>` Vue (icônes de ressources dans les menus, etc.).

Le sprite "joueur" est un cas particulier : une seule silhouette (`CHAR_ROWS`),
recolorée dynamiquement par joueur via une fonction `shade()` qui éclaircit/assombrit
une couleur hex — un seul sprite de base sert à N couleurs de joueurs sans dupliquer
les données.

**Avantage pour le nouveau jeu** : pas de pipeline d'assets, tout est versionné en
JS lisible, facile à itérer sans outil externe. **Limite connue** : ne scale pas
bien au-delà de sprites simples/statiques — pour de l'animation de combat ou des
sprites plus détaillés (armures, effets), il faudra probablement introduire de
vraies feuilles de sprites (image + découpage), surtout avec l'inspiration Minecraft
(items/armures avec beaucoup de variantes visuelles).

---

## 7. Input & mécanique de "join"

Quatre sources d'input unifiées derrière une classe `Input` (`input/index.js`) :
clavier (2 schémas simultanés, WASD+Espace/E et Flèches+Entrée), manette (Gamepad
API, plusieurs manettes), tactile (joystick virtuel), souris (clic = action pour P1).

**Mécanique de join** (`World.handleJoins`, appelée chaque frame) : personne n'existe
tant qu'aucun périphérique n'a appuyé sur son bouton d'action — à ce moment,
`addPlayer(source, gamepadIndex)` crée un nouveau joueur (couleur/position/inventaire
par défaut). Le tout premier joueur à rejoindre (peu importe le périphérique)
récupère le pseudo choisi dans le lobby (`netState.playerName`).

Chaque joueur porte un `source` (`'kb1' | 'kb2' | 'pad' | 'touch' | 'remote'`) qui
route son input vers la bonne fonction chaque frame (`World.inputFor`).

**Détail important pour une sauvegarde/reprise de partie** : au chargement d'une
sauvegarde, on ne restaure **aucun** joueur — le système redémarre exactement comme
une partie neuve (personne à l'écran, premier input = premier join). Ne pas essayer
de "reprendre" un joueur restauré avec son ancien périphérique : source d'ambiguïté
(quel périphérique doit reprendre quel perso ?) qui a causé plusieurs bugs
successifs sur `hamnet-village` avant qu'on tranche pour la version la plus simple.

---

## 8. Multijoueur en ligne — Supabase Realtime, sans backend

Un jeu multi-appareils **sans serveur applicatif** : tout passe par un channel
Supabase Realtime par room.

- **Topic** : `<prefixe-jeu>:room:<CODE6>` — le préfixe est **obligatoire** : le
  projet Supabase est partagé entre plusieurs jeux (`cine-planner`, `hamnet-village`,
  et bientôt le nouveau jeu), un topic non préfixé collisionnerait. Le nouveau jeu
  doit choisir son propre préfixe dès le départ (ex: `<slug-du-jeu>:room:<CODE>`).
- **Rôles** : `host` / `guest`, suivis via **Presence** (pas de registre serveur —
  il n'y a personne à qui demander "cette room existe-t-elle ?"). Un guest qui
  rejoint un code invalide est détecté **côté client** par un timeout (aucune
  presence host, aucun broadcast `state` reçu dans les 4s) plutôt que par un refus
  serveur immédiat.
- **Modèle autoritaire** : le **host** fait tourner la simulation complète
  (`World.update()`), les guests envoient seulement leur input (~30 Hz) et reçoivent
  un snapshot complet de l'état (~30 Hz) qu'ils appliquent tel quel + interpolent
  visuellement (`updateGuestVisuals`) — aucune simulation côté guest.
- **Canaux de message** (Broadcast) : `state` (host→tous, snapshot complet),
  `input` (guest→host), `guest_menu_action` (guest→host, actions de menu),
  `open_menu`/`close_menu` (host→guest ciblé, pour synchroniser l'UI de menu du
  guest sans qu'il simule lui-même la logique d'achat).
- **Piège d'API vécu** : les listeners `presence`/`broadcast` doivent être enregistrés
  **avant** `channel.subscribe()` — `realtime-js` lève une erreur si on les ajoute
  après que le channel a rejoint. Attention en particulier aux listeners de presence
  posés dans un callback asynchrone qui pourrait s'exécuter après le join.

Pour un jeu avec plus de mécaniques temps réel (combat PvP/PvE, par exemple), ce
modèle host-autoritaire à 30 Hz reste probablement le bon point de départ, mais la
**taille du snapshot** mérite d'être surveillée dès la spec (combat + farming +
inventaire détaillé + crafting peut vite alourdir un `state` broadcast complet à
30 Hz — envisager des deltas ou un découpage par canal si ça devient un sujet).

---

## 9. Auth — Supabase Auth, compte optionnel

Email + mot de passe via `supabase.auth.signUp/signInWithPassword/signOut`. Le
compte est **entièrement optionnel** : tout le jeu (solo et multi) fonctionne sans
connexion, seule la persistance change (voir §10). `netState.user` suit
`supabase.auth.onAuthStateChange` — un seul point de vérité, pas de logique d'auth
dupliquée ailleurs.

Le projet Supabase est **partagé** entre les jeux du dossier `dev/games/` (identité
commune), mais chaque jeu reste isolé sur ses propres tables/ressources (préfixées).
Pas de table utilisateur custom — l'app ne réutilise que l'identité (`auth.uid()`).

---

## 10. Persistance — la règle "connecté ou non", pas "solo ou multi"

Point de design central à retenir tel quel pour le nouveau jeu, car il a été source
de confusion côté joueurs de `hamnet-village` :

| | Non connecté | Connecté (compte) |
|---|---|---|
| Stockage | `localStorage` du navigateur | Table Postgres dédiée (RLS `owner_id = auth.uid()`) |
| Visible sur un autre appareil | Non | Oui |
| Fonctionne en solo ET en ligne | Oui | Oui |

**Ce n'est jamais le mode de jeu (local/host/guest) qui décide où sauvegarder — c'est
uniquement l'état de connexion.** Un joueur non connecté qui joue seul sauvegarde
en `localStorage` ; un joueur connecté qui joue seul sauvegarde déjà côté serveur.

Une table par jeu (`<prefixe>_worlds` par ex.), créée manuellement en SQL (pas de
migration automatisée — voir le SQL exact dans le README de `hamnet-village`), avec
RLS stricte dès la création (`for all using (auth.uid() = owner_id)`).

---

## 11. Déploiement — 100 % statique, GitHub Pages

- `vite.config.js` : `base: '/<repo-name>/'` en build (`/` en dev). **Piège vécu** :
  tout asset référencé par un chemin absolu (`/audio/…`) casse une fois servi sous
  ce sous-chemin — toujours utiliser `import.meta.env.BASE_URL` ou laisser Vite gérer
  les assets importés (jamais de chemin `/xxx` en dur pointant vers `public/`).
- `.github/workflows/pages-deploy.yml` : sur push `main`, `npm ci` → `npm run build`
  (avec `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` injectées depuis les **variables
  de repo GitHub**, pas des secrets — elles finissent de toute façon en clair dans le
  bundle client) → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- `.github/workflows/pr-main.yml` : sur chaque PR vers `main` — lint → test → build →
  install Playwright/Chromium → e2e. Tout doit passer avant merge.
- Aucun Docker, aucune infra à maintenir — le seul état serveur est Supabase.

---

## 12. Stratégie de tests

**Unitaires (Vitest, environnement `node`)** — logique pure et `net/*` :
- `localStorage`/`fetch` n'existent pas dans l'environnement `node` → `vi.stubGlobal(...)`
  en tête de fichier, avant tout import du module testé.
- `@supabase/supabase-js` n'est **pas** un simple wrapper fetch (SDK avec état
  interne) → toujours `vi.mock('../net/supabase.js', () => ({ supabase: mockObject }))`
  plutôt que de mocker `fetch`.
- Les modules `world/*` sont testés en construisant un faux contexte plutôt qu'un
  vrai `World` (`{ ...playerMethods, players: [], carts: [], spawnPoof: vi.fn(), … }`)
  — rapide, isolé, pas de dépendance au canvas/DOM.

**E2E (Playwright)** — vrai navigateur, dev server réel, **zéro dépendance réseau
réelle** :
- `playwright.config.js` force `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` vides
  quel que soit le `.env` local → le client Supabase retombe sur un placeholder fixe
  non joignable (`https://not-configured.supabase.co`, voir `net/supabase.js`).
- Les appels Auth REST et PostgREST sont interceptés avec `page.route()` contre ce
  placeholder — jamais de vrai projet Supabase touché en CI.
- Le Realtime (channels/presence) n'est **jamais** exercé pour de vrai : `realtime.js`
  vérifie un hook de test (`window.__HAMNET_REALTIME_TEST_HOOK__`) avant tout appel à
  `supabase.channel(...)` ; les specs e2e injectent un faux hook via
  `page.addInitScript` qui expose le `dispatch` interne du module, pour simuler des
  événements réseau (guest qui rejoint, déconnexion…) comme on pilote un mock
  WebSocket.

Cette stratégie (hook de test injecté + interception REST) est directement
réutilisable telle quelle pour le nouveau jeu — c'est ce qui permet une CI 100 %
déterministe sans dépendre d'un vrai projet Supabase.

---

## 13. Boucle de gameplay "économie" (transférable, à faire évoluer)

Le cœur de `hamnet-village` est une boucle idle/cozy assez classique, dont les
briques sont réutilisables même si le contenu change radicalement :

- **Ressources globales** (`game.wood`, etc.) avec un **cap** par ressource,
  augmentable via des upgrades de stockage.
- **Inventaire joueur** plafonné, auto-dépôt à l'approche du village/d'un point de
  collecte.
- **Bâtiments** : posés sur des emplacements fixes (`BUILD_SPOTS`), produisent une
  ressource à intervalle (`prodTimers`), améliorables (vitesse, capacité, transporteur
  auto…) via un système d'upgrade générique à coûts croissants ou fixes.
- **Upgrades globaux** (outils, capacité, bonus) : au choix `costs: []` (paliers fixes)
  ou `baseCost + growth` (croissance exponentielle) — un seul système générique
  (`upgradeCost()`/`buyUpgrade()`) pour tous, piloté par des définitions déclaratives.
- **Dépendances entre upgrades** : deux mécanismes génériques existent déjà et sont
  directement réutilisables pour un système de craft/équipement plus riche :
  `requiresLevel` (dépend d'un palier global) et `requiresUpgrade` (dépend d'un autre
  upgrade déjà possédé) — voir `store.js`. **Point de vigilance produit** : toute UI
  qui affiche une liste filtrée de choix (menu d'achat, inventaire de craft…) doit
  lire le **même** filtre que celui utilisé par la navigation clavier/manette,
  jamais une copie locale — un bug vécu sur `hamnet-village` (deux filtres légèrement
  différents pour la même liste) désynchronisait l'entrée sélectionnée visuellement
  de celle réellement achetée à la manette.

Pour "Stardew + combat + Minecraft-like crafting/armure", cette base (ressources
plafonnées, upgrades déclaratifs à dépendances, bâtiments à emplacements fixes) reste
un bon socle pour la partie "village/économie", mais il faudra très probablement
ajouter, en plus, dans la spec du nouveau jeu :
- Un vrai système d'**items discrets avec stacks** (pas juste des compteurs de
  ressource globaux) — nécessaire pour crafting/armure/équipement.
- Un système de **recettes de craft** (inputs multiples → output, éventuellement
  avec un "établi").
- Un système de **combat** (santé, dégâts, cooldowns, IA ennemie minimale) —
  actuellement totalement absent de `hamnet-village`.
- Probablement des **saisons/cycles** si l'inspiration Stardew va jusque-là (le jeu
  actuel n'a qu'un cycle jour/nuit cosmétique, `game.timeOfDay`).

---

## 14. Pièges concrets déjà rencontrés (à éviter dès la conception)

Liste issue de bugs réels corrigés sur `hamnet-village`, à garder en tête dès la
spec du nouveau jeu pour ne pas les réintroduire :

1. **Chemins d'assets absolus** (`/audio/...`) cassent sous un `base` GitHub Pages
   non-racine → toujours `import.meta.env.BASE_URL` ou laisser Vite résoudre les imports.
2. **Deux listes filtrées différemment pour la même donnée** (UI d'un côté, logique
   de navigation clavier/manette de l'autre) → toujours une seule fonction source de
   vérité, jamais de filtre dupliqué localement dans un composant Vue.
3. **Modale/UI qui ne se ferme qu'au clic souris** (pas de listener clavier/manette)
   → toute UI modale doit avoir un chemin de fermeture pour les 4 sources d'input dès
   sa création, pas ajouté après coup.
4. **Restaurer un joueur sauvegardé avec son ancien périphérique** au chargement →
   source de confusion (voir §7) ; préférer redémarrer le join à zéro comme une partie neuve.
5. **Sauvegarder un miroir réactif au lieu de la source de vérité** (`game.x` copié
   depuis `world.y` mais jamais `world.y` lui-même persisté) → toujours vérifier que
   `serializeWorld`/`applyWorldState` touchent la donnée réelle utilisée par la
   logique de jeu, pas seulement son reflet pour l'UI.
6. **Topic Realtime ou table Postgres non préfixés** → collision garantie avec un
   autre jeu du même projet Supabase partagé, à faire dès le premier commit du
   nouveau jeu, pas en rattrapage.

---

## 15. Checklist de démarrage pour le nouveau jeu

- [ ] Nouveau dossier sous `dev/games/<slug>`, repo git indépendant.
- [ ] Réutiliser tel quel : `vite.config.js` (base dynamique), structure `net/`
  (`supabase.js`, `accounts.js`, `netState.js`, `sync.js`, `realtime.js` avec un
  **nouveau préfixe de topic**), stratégie de tests (hook Realtime + interception
  REST en e2e), workflows GitHub Actions (`pr-main.yml`, `pages-deploy.yml`).
- [ ] Nouvelle table Postgres `<slug>_worlds` (même schéma RLS que `hamnet_worlds`),
  à créer manuellement dans le même projet Supabase que les autres jeux.
- [ ] Décider dès la spec : le pattern "mixins sur `World.prototype`" tient-il
  toujours avec combat + craft + farming, ou faut-il une architecture plus
  modulaire (systèmes séparés) vu la taille attendue du jeu ?
- [ ] Décider dès la spec : sprites pixel-art générés en JS (comme ici) ou vraies
  feuilles de sprites — l'ambition visuelle/armure/variantes du nouveau jeu dépasse
  probablement ce que le système ASCII actuel peut raisonnablement produire.
- [ ] Décider dès la spec : modèle réseau host-autoritaire à snapshot complet
  (simple, prouvé) vs deltas/canaux séparés si le state (combat + inventaire +
  craft) devient volumineux à 30 Hz.
- [ ] Concevoir le système d'items/inventaire/craft **avant** de coder quoi que ce
  soit — c'est la plus grosse divergence structurelle avec `hamnet-village`
  (ressources globales en compteur) et ça touche tout : sauvegarde, réseau, UI.

---

*Ce document décrit l'état de `hamnet-village` au 2026-08-29. Il ne couvre pas le
détail gameplay (bâtiments, upgrades précis, etc.) — voir le `CLAUDE.md` et le code
du repo si besoin d'aller plus loin sur un point précis.*
