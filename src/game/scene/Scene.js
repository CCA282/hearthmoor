import * as THREE from 'three'
import { CAMERA_FRUSTUM_SIZE, CAMERA_NEAR, CAMERA_FAR } from '../constants/camera.js'
import { PLAYER_SPEED } from '../constants/gameplay.js'
import { RESOURCE_NODES, NODE_HP, NODE_YIELD_PER_HIT, HARVEST_RANGE } from '../constants/nodes.js'
import { ENEMY_SPAWNS } from '../constants/enemies.js'
import { WORKBENCH_POSITION, CRAFT_RANGE, RECIPES } from '../constants/crafting.js'
import { ITEMS } from '../constants/items.js'
import {
  PLAYER_MAX_HEALTH, PLAYER_ATTACK_RANGE, PLAYER_ATTACK_COOLDOWN,
  ENEMY_MAX_HEALTH, ENEMY_ATTACK_DAMAGE, ENEMY_RESPAWN_TIME,
} from '../constants/combat.js'
import { cameraPositionFor } from './camera.js'
import { stepPosition } from './movement.js'
import { findNearestNode, hitNode, tickNodeRespawn } from './resources.js'
import { stepEnemy, findNearestEnemy } from './enemyAI.js'
import { createInventory, addItem } from '../inventory.js'
import { canAffordRecipe, craftRecipe } from '../crafting.js'
import { equipItem, attackDamageFor } from '../equipment.js'
import { applyDamage, isDead } from '../combat.js'
import { game } from '../store.js'

const HARVEST_HINT = 'Espace / A pour récolter'
const CRAFT_HINT = 'Espace / A pour forger la hache'
const ATTACK_HINT = 'F / X pour attaquer'
const LOCAL_PLAYER_ID = 'local'
const LOCAL_PLAYER_COLOR = '#6fa8b8'
const REMOTE_PLAYER_COLOR = '#c8895a'
const SPAWN_POSITION = { x: 3, y: 0.9, z: 3 }

// Semi-isometric fixed-angle camera, low-poly ground + simple lighting/fog —
// see docs/spec.md §3-4. No renderer here: WebGLRenderer needs a real <canvas>
// and is owned by engine.js, so this class stays constructible (and mostly
// testable) outside a browser too.
//
// Multiplayer model: `players` holds everyone visible in the scene — the
// local one (id === localPlayerId, driven by the real Input) plus remote
// ones (driven by whatever was last received via applyRemoteInput). Guests
// don't drive anyone locally at all — see applySnapshot()/updateGuestVisuals()
// below and docs/spec.md §7 for why there's no client-side prediction.
export class Scene {
  constructor() {
    this.three = new THREE.Scene()
    this.three.background = new THREE.Color('#12181c')
    this.three.fog = new THREE.Fog('#12181c', 26, 70)

    this._setupLights()
    this._setupGround()
    this._setupHearthMarker()
    this._setupNodes()
    this._setupEnemies()
    this._setupWorkbench()

    this.players = []
    this.localPlayerId = LOCAL_PLAYER_ID
    this.addPlayer(LOCAL_PLAYER_ID, SPAWN_POSITION)

    this.nearestNode = null
    this.nearestEnemy = null

    this.cameraTarget = this.localPlayer.position
    this.camera = this._createCamera()
    this._updateCamera()
  }

  get localPlayer() {
    return this.findPlayer(this.localPlayerId)
  }

  findPlayer(id) {
    return this.players.find((p) => p.id === id) ?? null
  }

  addPlayer(id, position = SPAWN_POSITION) {
    const existing = this.findPlayer(id)
    if (existing) return existing

    const geo = new THREE.CapsuleGeometry(0.45, 0.9, 4, 8)
    const color = id === this.localPlayerId ? LOCAL_PLAYER_COLOR : REMOTE_PLAYER_COLOR
    const mat = new THREE.MeshLambertMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(position.x, position.y, position.z)
    this.three.add(mesh)

    const player = {
      id, position: { ...position }, mesh,
      inventory: createInventory(),
      equipment: { weapon: null },
      health: PLAYER_MAX_HEALTH, maxHealth: PLAYER_MAX_HEALTH, attackCooldown: 0,
      remoteInput: null,
    }
    this.players.push(player)
    if (id === this.localPlayerId) this._syncLocalHudFromPlayer(player)
    return player
  }

  _syncLocalHudFromPlayer(player) {
    game.inventory = player.inventory
    game.health = player.health
    game.maxHealth = player.maxHealth
    game.equipment = player.equipment
  }

  removePlayer(id) {
    const idx = this.players.findIndex((p) => p.id === id)
    if (idx === -1) return
    this.three.remove(this.players[idx].mesh)
    this.players.splice(idx, 1)
  }

  // Guest side: which player in the (possibly not-yet-received) snapshot is
  // "me" — known as soon as joinRoomAsGuest() resolves with our own guestId,
  // but a `state` broadcast can arrive and create that player entry (colored
  // as remote, since localPlayerId wasn't set yet) before that resolves. Fix
  // the color up if so — see engine.js/Lobby.vue (task 14/15) for the race.
  setLocalPlayerId(id) {
    this.localPlayerId = id
    const player = this.findPlayer(id)
    if (player) player.mesh.material.color.set(LOCAL_PLAYER_COLOR)
  }

  // Host: full snapshot broadcast to guests (~30Hz, see engine.js task 14) —
  // plain data only, no THREE references.
  serializeSnapshot() {
    return {
      players: this.players.map((p) => ({
        id: p.id,
        x: p.position.x, y: p.position.y, z: p.position.z,
        inventory: p.inventory,
        health: p.health,
      })),
      nodes: this.nodes.map((n) => ({
        id: n.id, hp: n.hp, depleted: n.depleted, respawnTimer: n.respawnTimer,
      })),
      enemies: this.enemies.map((e) => ({
        id: e.id, x: e.position.x, y: e.position.y, z: e.position.z, health: e.health,
      })),
    }
  }

  // Guest: apply a snapshot received from the host — no local simulation, the
  // received state simply *is* the truth (docs/spec.md §7). Creates/removes
  // player entries to match who the host says is in the room.
  applySnapshot(snap) {
    const seenIds = new Set()
    for (const sp of snap.players) {
      seenIds.add(sp.id)
      const player = this.addPlayer(sp.id, { x: sp.x, y: sp.y, z: sp.z })
      player.position = { x: sp.x, y: sp.y, z: sp.z }
      player.mesh.position.set(sp.x, sp.y, sp.z)
      player.inventory = sp.inventory
      player.health = sp.health
      if (player.id === this.localPlayerId) this._syncLocalHudFromPlayer(player)
    }
    for (const p of [...this.players]) {
      if (!seenIds.has(p.id)) this.removePlayer(p.id)
    }

    for (const sn of snap.nodes) {
      const node = this.nodes.find((n) => n.id === sn.id)
      if (!node) continue
      node.hp = sn.hp
      node.depleted = sn.depleted
      node.respawnTimer = sn.respawnTimer
      node.mesh.visible = !node.depleted
    }

    // Enemies are pre-created identically on host and guest (same
    // ENEMY_SPAWNS constants, see _setupEnemies) — just sync position/health
    // and derive visibility, same pattern as nodes above.
    for (const se of snap.enemies ?? []) {
      const enemy = this.enemies.find((e) => e.id === se.id)
      if (!enemy) continue
      enemy.position = { x: se.x, y: se.y, z: se.z }
      enemy.health = se.health
      enemy.mesh.position.set(se.x, se.y, se.z)
      enemy.mesh.visible = !isDead(enemy.health)
    }
  }

  // Host side: latest input a guest sent for their player (see engine.js's
  // _tickHost/onInput wiring, task 14).
  applyRemoteInput(id, input) {
    const player = this.findPlayer(id)
    if (player) player.remoteInput = input
  }

  _createCamera() {
    const s = CAMERA_FRUSTUM_SIZE
    const camera = new THREE.OrthographicCamera(-s, s, s, -s, CAMERA_NEAR, CAMERA_FAR)
    return camera
  }

  // Called by engine.js on resize — keeps the frustum height fixed (constant
  // zoom) while adapting width to the canvas aspect ratio.
  setAspect(aspect) {
    const s = CAMERA_FRUSTUM_SIZE
    this.camera.left = -s * aspect
    this.camera.right = s * aspect
    this.camera.top = s
    this.camera.bottom = -s
    this.camera.updateProjectionMatrix()
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight('#8fa8ad', 0.7)
    const sun = new THREE.DirectionalLight('#fff3d6', 1.1)
    sun.position.set(8, 14, 6)
    this.three.add(ambient, sun)
  }

  _setupGround() {
    const geo = new THREE.PlaneGeometry(160, 160)
    const mat = new THREE.MeshLambertMaterial({ color: '#4c6152' })
    const ground = new THREE.Mesh(geo, mat)
    ground.rotation.x = -Math.PI / 2
    this.three.add(ground)
  }

  // Temporary visual anchor at the camp's spawn point (0,0,0) — placeholder
  // for the real hearth/campfire prop, useful in the meantime to eyeball that
  // the ground/camera/lighting are actually oriented correctly.
  _setupHearthMarker() {
    const geo = new THREE.ConeGeometry(0.8, 1.6, 6)
    const mat = new THREE.MeshLambertMaterial({ color: '#e8974a' })
    const marker = new THREE.Mesh(geo, mat)
    marker.position.set(0, 0.8, 0)
    this.three.add(marker)
  }

  _setupNodes() {
    this.nodes = RESOURCE_NODES.map((def) => {
      const mesh = def.kind === 'tree' ? this._buildTreeMesh() : this._buildRockMesh()
      mesh.position.set(def.x, 0, def.z)
      this.three.add(mesh)
      return { ...def, hp: NODE_HP, depleted: false, respawnTimer: 0, mesh }
    })
  }

  _buildTreeMesh() {
    const group = new THREE.Group()
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: '#5a4632' }),
    )
    trunk.position.y = 0.6
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.8, 7),
      new THREE.MeshLambertMaterial({ color: '#3f6b4a' }),
    )
    canopy.position.y = 1.9
    group.add(trunk, canopy)
    return group
  }

  _buildRockMesh() {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.MeshLambertMaterial({ color: '#8a8a86' }),
    )
    mesh.position.y = 0.45
    return mesh
  }

  _setupEnemies() {
    this.enemies = ENEMY_SPAWNS.map((def) => {
      const spawnPosition = { x: def.x, y: 0.3, z: def.z }
      const mesh = this._buildEnemyMesh()
      mesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z)
      this.three.add(mesh)
      return {
        id: def.id,
        position: { ...spawnPosition },
        spawnPosition,
        health: ENEMY_MAX_HEALTH,
        maxHealth: ENEMY_MAX_HEALTH,
        state: 'idle',
        stateTimer: 0,
        targetId: null,
        respawnTimer: 0,
        mesh,
      }
    })
  }

  // Placeholder "sanglier" — body + head, low-poly boxes. Real fauna models
  // land later, see docs/hamnet-village-tech-foundation.md §6.
  _buildEnemyMesh() {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.55, 0.6),
      new THREE.MeshLambertMaterial({ color: '#7a4a34' }),
    )
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.4, 0.45),
      new THREE.MeshLambertMaterial({ color: '#6a3f2c' }),
    )
    head.position.set(0.7, 0, 0)
    group.add(body, head)
    return group
  }

  // A single fixed crafting spot near camp (docs/spec.md §9) — one recipe
  // for now (see constants/crafting.js), no selection UI needed yet.
  _setupWorkbench() {
    const geo = new THREE.BoxGeometry(1.4, 0.5, 0.9)
    const mat = new THREE.MeshLambertMaterial({ color: '#8a6a44' })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(WORKBENCH_POSITION.x, WORKBENCH_POSITION.y + 0.25, WORKBENCH_POSITION.z)
    this.three.add(mesh)
    this.workbench = { position: WORKBENCH_POSITION, mesh }
  }

  _nearWorkbench(pos) {
    const d = Math.hypot(this.workbench.position.x - pos.x, this.workbench.position.z - pos.z)
    return d <= CRAFT_RANGE
  }

  // Consumes the recipe's cost and adds its output to the player's
  // inventory; auto-equips it if that item's slot is currently empty (no
  // manual equip/swap UI yet — see constants/items.js, only one weapon exists).
  _craftFor(player, recipe) {
    if (!canAffordRecipe(player.inventory, recipe)) return
    player.inventory = craftRecipe(player.inventory, recipe)

    const slot = ITEMS[recipe.output]?.slot
    if (slot && !player.equipment[slot]) {
      player.equipment = equipItem(player.equipment, recipe.output)
    }

    if (player.id === this.localPlayerId) this._syncLocalHudFromPlayer(player)
  }

  _movePlayer(player, dir, dt) {
    player.position = stepPosition(player.position, dir, PLAYER_SPEED, dt)
    player.mesh.position.set(player.position.x, player.position.y, player.position.z)
    if (dir.x !== 0 || dir.z !== 0) {
      player.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  }

  _remoteMoveVector(player) {
    return { x: player.remoteInput?.mx ?? 0, z: player.remoteInput?.mz ?? 0 }
  }

  // A guest's input pulse is already edge-detected on their end (see engine.js's
  // _tickGuest, task 14) — consume it once so a single press doesn't harvest
  // repeatedly across the frames before the next input message arrives.
  _consumeRemoteAction(player) {
    const pressed = !!player.remoteInput?.action
    if (pressed && player.remoteInput) player.remoteInput.action = false
    return pressed
  }

  // Same one-shot consumption, for the attack button (task 21 wires the
  // guest side to actually send `attack` in its input payload).
  _consumeRemoteAttack(player) {
    const pressed = !!player.remoteInput?.attack
    if (pressed && player.remoteInput) player.remoteInput.attack = false
    return pressed
  }

  // One hit: yields an item, depletes the node after NODE_HP hits. The actual
  // hp/depleted/respawnTimer transitions are pure (resources.js) — this just
  // applies the result and syncs the THREE mesh + inventory.
  _harvestFor(player, node) {
    const idx = this.nodes.indexOf(node)
    const updated = hitNode(node)
    this.nodes[idx] = updated
    updated.mesh.visible = !updated.depleted
    if (updated.depleted && this.nearestNode === node) this.nearestNode = null

    const { inventory } = addItem(player.inventory, node.item, NODE_YIELD_PER_HIT)
    player.inventory = inventory
    if (player.id === this.localPlayerId) this._syncLocalHudFromPlayer(player)
  }

  // Player → enemy: deals damage, and on the killing blow, removes the enemy
  // (mesh hidden, respawn timer starts — see _updateEnemies) and drops a
  // small amount of loot into the attacker's inventory.
  _attackFor(player, enemy) {
    enemy.health = applyDamage(enemy.health, attackDamageFor(player))
    if (!isDead(enemy.health)) return

    enemy.mesh.visible = false
    enemy.state = 'idle'
    enemy.targetId = null
    enemy.respawnTimer = ENEMY_RESPAWN_TIME
    if (this.nearestEnemy === enemy) this.nearestEnemy = null

    const { inventory } = addItem(player.inventory, 'meat', 1)
    player.inventory = inventory
    if (player.id === this.localPlayerId) this._syncLocalHudFromPlayer(player)
  }

  // Enemy → player: deals damage; a lethal hit respawns the player at camp
  // with full health (no punishing loss — see docs/spec.md's overall tone).
  _damagePlayer(player, amount) {
    player.health = applyDamage(player.health, amount)
    if (player.id === this.localPlayerId) game.health = player.health
    if (isDead(player.health)) this._respawnPlayer(player)
  }

  _respawnPlayer(player) {
    player.health = player.maxHealth
    player.position = { ...SPAWN_POSITION }
    player.mesh.position.set(SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z)
    if (player.id === this.localPlayerId) game.health = player.health
  }

  // Host/solo only — guests never run this (no enemies in their local Scene
  // until task 21 adds them to the snapshot). Ticks AI for living enemies,
  // applies damage on a landed hit, and respawns dead ones after a delay.
  _updateEnemies(dt) {
    const playerRefs = this.players.map((p) => ({ id: p.id, position: p.position }))
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i]

      if (isDead(enemy.health)) {
        const respawnTimer = enemy.respawnTimer - dt
        if (respawnTimer > 0) {
          this.enemies[i] = { ...enemy, respawnTimer }
          continue
        }
        const respawned = {
          ...enemy,
          health: enemy.maxHealth,
          position: { ...enemy.spawnPosition },
          state: 'idle',
          targetId: null,
          respawnTimer: 0,
        }
        respawned.mesh.position.set(respawned.position.x, respawned.position.y, respawned.position.z)
        respawned.mesh.visible = true
        this.enemies[i] = respawned
        continue
      }

      const updated = stepEnemy(enemy, playerRefs, dt)
      updated.mesh.position.set(updated.position.x, updated.position.y, updated.position.z)
      this.enemies[i] = updated

      if (updated.justAttacked && updated.targetId) {
        const target = this.findPlayer(updated.targetId)
        if (target) this._damagePlayer(target, ENEMY_ATTACK_DAMAGE)
      }
    }
  }

  _updateNodes(dt) {
    for (let i = 0; i < this.nodes.length; i++) {
      const updated = tickNodeRespawn(this.nodes[i], dt)
      if (updated !== this.nodes[i]) {
        this.nodes[i] = updated
        updated.mesh.visible = !updated.depleted
      }
    }
  }

  _updateCamera() {
    const pos = cameraPositionFor(this.cameraTarget)
    this.camera.position.set(pos.x, pos.y, pos.z)
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z)
  }

  // Solo and host: full local simulation. Guests never call this — see
  // applySnapshot()/updateGuestVisuals() instead.
  update(dt, input) {
    this._updateNodes(dt)
    this._updateEnemies(dt)

    for (const player of this.players) {
      const isLocal = player.id === this.localPlayerId
      if (isLocal && !input) continue

      const dir = isLocal ? input.moveVector() : this._remoteMoveVector(player)
      this._movePlayer(player, dir, dt)

      const nearestNode = findNearestNode(this.nodes, player.position, HARVEST_RANGE)
      const nearWorkbench = this._nearWorkbench(player.position)
      const nearestEnemy = findNearestEnemy(this.enemies, player.position, PLAYER_ATTACK_RANGE)
      if (isLocal) {
        this.nearestNode = nearestNode
        this.nearestEnemy = nearestEnemy
        game.hint = nearestNode ? HARVEST_HINT : nearWorkbench ? CRAFT_HINT : nearestEnemy ? ATTACK_HINT : ''
      }

      const actionPressed = isLocal ? input.actionPressed() : this._consumeRemoteAction(player)
      if (nearestNode && actionPressed) this._harvestFor(player, nearestNode)
      else if (nearWorkbench && actionPressed) this._craftFor(player, RECIPES[0])

      player.attackCooldown = Math.max(0, player.attackCooldown - dt)
      const attackPressed = isLocal ? input.attackPressed() : this._consumeRemoteAttack(player)
      if (nearestEnemy && attackPressed && player.attackCooldown <= 0) {
        this._attackFor(player, nearestEnemy)
        player.attackCooldown = PLAYER_ATTACK_COOLDOWN
      }
    }

    if (this.localPlayer) this.cameraTarget = this.localPlayer.position
    this._updateCamera()
  }

  // Guest: no local simulation (see docs/spec.md §7) — just keep the camera
  // (and later, any purely-cosmetic animation) ticking between snapshots.
  updateGuestVisuals(_dt) {
    if (this.localPlayer) this.cameraTarget = this.localPlayer.position
    this._updateCamera()
  }
}
