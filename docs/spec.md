# Hearthmoor — spec (brouillon v1)

> Nom du jeu : **Hearthmoor** — slug : `hearthmoor` (dossier `dev/games/hearthmoor`,
> préfixe topic Realtime `hearthmoor:room:<CODE>`, table Postgres `hearthmoor_worlds`).

> Brouillon de travail, pas figé — chaque section marquée **🟡 Hypothèse** est une
> proposition à valider/corriger avant qu'on parte coder quoi que ce soit. Basé sur
> `hamnet-village-tech-foundation.md` (mêmes fondations Supabase/déploiement/tests),
> mais avec un changement structurant : **moteur 3D** au lieu du canvas 2D.
>
> Décisions déjà actées avec toi :
> - **Rendu 3D low-poly** (type Three.js) — pas de réutilisation du moteur canvas 2D.
> - **Monde fixe, dessiné à la main**, pas de génération procédurale.
> - **Pas de mode construction libre** — des emplacements de bâtiment prédéfinis,
>   comme les `BUILD_SPOTS` de hamnet-village.
> - **Caméra semi-isométrique** (fixe, façon Diablo) plutôt que 3e personne à l'épaule.
> - **4 zones v1** : Prairie, Forêt sombre, Marais, Montagne.
> - **3 armes + bouclier** : hache, épée, arc, bouclier (blocage) — 3 tiers chacune.

---

## 1. Pitch

Un jeu de survie/aventure coopératif en 3D low-poly, ambiance viking/nordique façon
Valheim, mais délibérément plus simple : moins de systèmes, moins de biomes, pas de
construction libre, un monde fixe et raisonnablement grand plutôt que procédural
infini. Le joueur explore, combat, récolte, s'équipe et fait progresser son
personnage — seul ou avec d'autres via une room en ligne (même modèle que
hamnet-village : code à 6 caractères, host/guest via Supabase Realtime).

---

## 2. Ce qui change vs la fondation hamnet-village

| | hamnet-village | nouveau jeu |
|---|---|---|
| Rendu | Canvas 2D, sprites pixel-art générés en JS | **3D low-poly (Three.js)**, vraies géométries + matériaux simples |
| Caméra | Top-down fixe | **Semi-isométrique fixe** (façon Diablo), même esprit que le top-down actuel mais avec profondeur 3D |
| Monde | Un village + alentours, une seule "scène" | Carte fixe plus grande, découpée en **4 zones** (Prairie, Forêt sombre, Marais, Montagne) |
| Bâtiments | Emplacements fixes (`BUILD_SPOTS`), achat direct | Même principe : **emplacements prédéfinis**, pas de placement libre |
| Boucle de jeu | Idle/cozy, ressources en compteur global | **Action-RPG** : combat, inventaire d'objets discrets, équipement |
| Backend | Supabase (Auth/Postgres/Realtime), GitHub Pages | **Identique, inchangé** |
| Tests | Vitest + Playwright, mocks Supabase/Realtime | **Identique, inchangé** (stratégie de mock 100% réutilisable) |

Tout le §8 à §12 de la fondation (multijoueur Realtime, auth, persistance,
déploiement, stratégie de tests) **s'applique tel quel**. Ce qui change, c'est
uniquement la couche "moteur de jeu" (rendu + logique de scène 3D à la place du
canvas 2D) — voir §11 ci-dessous pour la structure de projet mise à jour.

---

## 3. Caméra & contrôles — ✅ Actée

- Caméra **semi-isométrique fixe** (angle et distance constants, façon Diablo/Hades),
  pas de rotation libre par le joueur. Nettement plus simple qu'une 3e personne à
  l'épaule : pas de gestion de collision caméra/décor, visée et lecture du combat
  plus lisibles, et l'angle fixe tolère mieux la latence réseau (les positions
  relatives restent lisibles même avec un léger désync).
- Déplacement **relatif au monde** (comme le top-down de hamnet-village) plutôt que
  relatif à la caméra — un stick/WASD "haut" déplace toujours dans la même direction
  du monde, peu importe où on regarde. Plus simple à contrôler à la manette, et ça
  réutilise l'intuition déjà acquise sur hamnet-village.
- Manette : stick gauche = déplacement, gâchette/bouton = attaque (dans la direction
  du déplacement ou vers l'ennemi le plus proche — 🟡 à trancher en implémentant),
  bouton = blocage (si bouclier équipé), bouton = esquive/roulade.
- Clavier + souris : WASD = déplacement, clic gauche = attaque, clic droit ou touche
  dédiée = blocage, Espace = esquive.

---

## 4. Style visuel — 🟡 Hypothèse

"Low-poly simplifié" concrètement, pour rester gérable :
- Géométries simples (primitives + quelques modèles low-poly faits main ou générés),
  **pas** de sculpting/photogrammétrie.
- Éclairage simple : une lumière directionnelle (soleil) + ambiante, pas de global
  illumination temps réel. Brouillard de scène (`fog` Three.js) pour l'ambiance et
  masquer la distance de rendu — Valheim s'appuie beaucoup là-dessus, c'est un
  effet peu coûteux et très efficace visuellement.
- Ombrage plat/toon-ish plutôt que PBR complet — cohérent avec "plus simple" et
  moins cher à produire visuellement (pas besoin de textures PBR complexes par objet).
- Palette de couleurs limitée par zone (comme les biomes Valheim, mais en beaucoup
  plus réduit — voir §5).

---

## 5. Monde — carte fixe, 4 zones ✅ Actées

Une carte fixe, dessinée à la main, découpée en 4 zones concentriques autour du
camp de base (le camp = équivalent du "village" hamnet-village, point de spawn
central avec les emplacements de bâtiment les plus proches/sûrs) :

| Zone | Rôle | Ressources | Ennemis | Tier d'équipement |
|---|---|---|---|---|
| **Prairie** (spawn) | Zone sûre, tutoriel | Bois, pierre, fibres | Sangliers, loups faibles | Tier 1 (bois/bronze) |
| **Forêt sombre** | Première vraie difficulté | Bois dur, minerai basique | Squelettes, gobelins | Tier 1 → 2 |
| **Marais** | Zone à risque, ressource spéciale | Ferraille/tourbe, plantes rares | Morts-vivants, poison ambiant | Tier 2 (fer) |
| **Montagne** | Zone tardive, hostile (froid) | Minerai rare (argent) | Loups d'élite, un mini-boss | Tier 3 (argent) |

- Chaque zone a sa palette de couleurs/ambiance propre (§4), ses ressources et ses
  ennemis dédiés, et 1-2 emplacements de bâtiment/craft quand c'est pertinent.
- **Progression spatiale** façon Valheim en version light : le tier d'équipement
  fabricable dans une zone conditionne la viabilité de la zone suivante (ex : la
  Montagne demande le tier 2/fer minimum pour survivre au froid + aux loups
  d'élite) — sans système de boss/portails complet en v1.
- 🟡 Une 5e zone (côte/pêche) reste un bonus si le temps le permet, pas dans le
  socle v1.

---

## 6. Personnage & progression — 🟡 Hypothèse

Simplifié par rapport au système de compétences par arme de Valheim :
- **Un niveau de personnage global** (XP gagné en combat/récolte/exploration),
  plutôt que des compétences par arme qui montent séparément — plus simple à
  équilibrer et à comprendre pour un jeu "simplifié".
- Stats dérivées du niveau + de l'équipement : points de vie, endurance (stamina),
  dégâts, armure.
- Pas de système de faim/nourriture complexe en v1 (Valheim a 3 slots de nourriture
  avec effets temporaires) — à réintroduire plus tard si besoin, mais ça ajoute une
  gestion d'inventaire/de timers supplémentaire dès le départ sinon.

---

## 7. Combat — 🟡 Hypothèse importante (impact réseau)

Simplifié par rapport à Valheim, et **volontairement conçu pour tolérer la latence
réseau** plutôt que de viser un combat "précis au frame près" :

- Endurance (stamina) unique, consommée par l'attaque, l'esquive et le sprint —
  comme Valheim mais sans les nuances par arme.
- Attaques **télégraphiées** (une petite fenêtre d'anticipation visible avant que
  le coup parte) plutôt que des coups instantanés — ça rend le jeu jouable en
  multijoueur sur un modèle réseau simple (voir point technique ci-dessous), et
  c'est cohérent avec "plus simple que Valheim".
- Blocage/esquive simples (pas de parry au frame près qui annule tous les dégâts).
- **4 armes v1** (✅ actées) : hache (corps-à-corps rapide, double usage — sert
  aussi à couper le bois, comme dans Valheim), épée (corps-à-corps équilibrée),
  arc (distance, nécessaire contre certains ennemis), bouclier (slot séparé,
  active le blocage). Une pioche reste un outil pur (minerai/pierre), pas une arme
  — cohérent avec le modèle hamnet-village (outil = débloque la récolte d'une
  ressource) plutôt que de multiplier les types d'armes.
- **3 tiers par arme**, alignés sur les 4 zones (§5) : bois/bronze (Prairie/Forêt),
  fer (Marais), argent (Montagne).

**⚠️ Point technique important** : le modèle réseau de hamnet-village (host fait
tourner toute la simulation, les guests envoient juste leur input et affichent le
snapshot reçu, sans prédiction locale) fonctionnait bien pour un jeu cozy sans
enjeu de timing. Pour du combat, un guest qui n'a **aucune prédiction locale** de
ses propres mouvements/attaques ressentira un délai (input → confirmation visuelle)
égal à l'aller-retour réseau. Deux options :
1. **Accepter ce délai** et concevoir le combat autour (attaques télégraphiées,
   pas d'exigence de réflexe au frame près) — c'est l'option la plus simple, cohérente
   avec "plus simple que Valheim", et je la recommande pour une v1.
2. Ajouter de la **prédiction côté client** pour le perso du joueur local (le guest
   simule son propre mouvement/attaque immédiatement, puis se recale si besoin sur
   l'état du host) — plus fidèle niveau feeling, mais un chantier réseau nettement
   plus gros que tout ce qui existe dans hamnet-village aujourd'hui.

Je recommande l'option 1 pour la v1, avec la possibilité de revoir en 2 si le
combat "à l'aveugle" pose vraiment problème en playtest.

---

## 8. Inventaire & équipement

Rupture nette avec le modèle hamnet-village (ressources en compteur global) :
- **Inventaire à grille**, objets discrets empilables (comme Valheim/Minecraft),
  pas des compteurs `game.wood`/`game.stone`.
- Slots d'équipement séparés : arme, casque, torse, jambes (🟡 pas d'accessoires/
  anneaux en v1, pour rester simple).
- Le craft consomme des objets de l'inventaire selon une recette (voir §9).

C'est le changement de modèle de données le plus profond par rapport à
hamnet-village — impacte la sauvegarde (sérialiser une grille d'objets plutôt que
des compteurs), le réseau (la taille du snapshot d'un inventaire complet est plus
grosse qu'un compteur), et toute l'UI d'inventaire (drag & drop ou navigation
manette/clavier à concevoir dès le départ, pas juste souris).

### Tiers d'armure ✅ Actés

Alignés sur les mêmes 4 zones que les armes (§7), une seule ressource par zone
débloque tout un tier de matos (arme *et* armure — pas de chaîne de ressources
séparée pour l'armure) :

| Tier | Matériau | Zone(s) source | Casque / Torse / Jambes |
|---|---|---|---|
| **1** | Cuir/Bronze | Prairie, Forêt sombre | Défense faible |
| **2** | Fer | Marais | Défense moyenne (~×2 du tier 1) |
| **3** | Argent | Montagne | Défense haute (~×2 du tier 2) |

- Pas de poids/encombrement (contrairement à Valheim) — chaque pièce donne un
  bonus de défense plat, sans malus de vitesse/endurance. 🟡 À réintroduire plus
  tard si l'armure se révèle "gratuite"/sans arbitrage intéressant en playtest.
- Pas de bonus de set complet en v1 (porter les 3 pièces du même tier = juste la
  somme des défenses, rien de plus).

---

## 9. Craft & bâtiments — emplacements prédéfinis

Reprend directement le pattern `BUILD_SPOTS` + menu d'achat de hamnet-village,
adapté à un modèle "objets" plutôt que "compteurs de ressources" :
- Emplacements de bâtiment fixes sur la carte (pas de placement libre).
- Un "établi" ou point de craft (fixe, comme un `BUILD_SPOTS`) permet de
  transformer des objets récoltés en équipement/outils via des recettes.
- Réutilise directement les mécanismes génériques déjà présents dans
  hamnet-village : `requiresLevel` / `requiresUpgrade` (dépendances entre recettes/
  bâtiments) — juste réappliqués à des recettes de craft plutôt qu'à des upgrades
  de compteur.

---

## 10. Multijoueur — rooms Supabase (identique à hamnet-village)

Le modèle host/guest par room Realtime de hamnet-village est repris **sans
changement d'architecture** (voir fondation §8) : un joueur crée une room (code à
6 caractères), les autres rejoignent avec ce code — chacun sur son propre appareil.

❌ **Abandonné** : le cas "deux fenêtres sur le même PC, une manette chacune"
(local via deux instances de l'app) n'est plus dans le scope. Pas de dev ni de
spike dédié là-dessus. Rien n'empêche un joueur d'ouvrir deux fenêtres et de
rejoindre la même room manuellement s'il le souhaite (c'est juste le multijoueur
en ligne normal, sans garantie particulière sur le comportement des manettes dans
ce cas) — mais ce n'est plus un cas qu'on conçoit ou qu'on teste spécifiquement.

---

## 11. Stack technique mis à jour

Ajouts par rapport à la fondation hamnet-village :

| Ajout | Rôle |
|---|---|
| `three` | Moteur de rendu 3D (scène, caméra, lumières, matériaux, chargement de modèles) |
| Format de modèles 🟡 (glTF probable) | Format standard, bien supporté par Three.js et les outils de modélisation low-poly (Blender export glTF) |

Tout le reste (`vue`, `@supabase/supabase-js`, Vite, Vitest, Playwright, ESLint)
reste identique.

Structure de projet — même squelette que hamnet-village, `game/world/*` remplacé
par une couche scène 3D :

```
src/
  game/
    engine.js          # boucle RAF — identique dans l'esprit, pilote Three.js au lieu du ctx canvas 2D
    store.js            # game = reactive({...}) — état partagé UI, même rôle
    scene/               # remplace world/ : setup Three.js (scene, caméra, lumières, chargement de modèles)
      Scene.js            # class Scene — équivalent de World.js, même pattern update()/render()
      <domaine>.js         # mixins par domaine (combat.js, players.js, inventory.js, buildings.js…) — même pattern qu'aujourd'hui
    entities/             # modèles/comportements des personnages, ennemis, objets ramassables
    constants/            # inchangé dans l'esprit : données de jeu déclaratives (armes, recettes, zones…)
  net/                   # inchangé à 100% (supabase.js, accounts.js, netState.js, realtime.js, sync.js)
  components/            # UI Vue : inventaire, HUD combat, menu de craft, lobby — même pattern que hamnet-village
```

Le pattern "mixins sur une classe centrale" (`World.prototype` → `Scene.prototype`)
reste probablement pertinent en 3D aussi, mais à surveiller : plus de systèmes
(combat, IA ennemie, inventaire, craft) que dans hamnet-village — si ça devient
difficile à suivre, découper en vrais modules avec une interface claire plutôt que
tout mixer sur un seul prototype.

---

## 12. Persistance & réseau — inchangé dans le principe

- Règle "connecté ou non" de la fondation (§10) conservée telle quelle.
- Nouvelle table Postgres dédiée `hearthmoor_worlds`, même schéma RLS que `hamnet_worlds`.
- Nouveau préfixe de topic Realtime `hearthmoor:room:<CODE>`.
- Le `snap` sauvegardé/broadcasté sera plus gros qu'avant (inventaires à grille,
  positions/orientations 3D, état de combat) — à surveiller dès les premiers tests
  de charge réseau, voir §7.

---

## 13. Ce qui reste à trancher avant de coder

1. ~~Caméra 3e personne ou semi-isométrique ?~~ ✅ Semi-isométrique fixe (§3).
2. ~~Liste des zones/biomes v1~~ ✅ 4 zones : Prairie, Forêt sombre, Marais,
   Montagne (§5).
3. ~~Liste d'armes/équipement v1~~ ✅ Hache, épée, arc, bouclier, 3 tiers (§7-8).
4. ~~Nom du jeu / slug~~ ✅ **Hearthmoor** (`hearthmoor`).
5. ~~"2 fenêtres + 2 manettes" sur le même PC~~ ❌ Abandonné, hors scope (§10).
6. ~~Confirmer l'option combat~~ ✅ Option 1 : latence tolérée, pas de prédiction
   côté client, attaques télégraphiées (§7). Piste "prédiction du déplacement
   seul" gardée en tête pour une v2 si besoin.
7. ~~Tiers d'armure~~ ✅ 3 tiers (cuir/bronze, fer, argent), alignés sur les zones
   et les tiers d'armes, sans poids ni bonus de set (§8).

Tous les points sont tranchés — la spec v1 est prête pour créer le repo.

---

*Brouillon — à faire évoluer avec toi avant de créer le repo et de commencer à coder.*
