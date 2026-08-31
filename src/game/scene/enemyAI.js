import {
  ENEMY_AGGRO_RANGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_WINDUP,
  ENEMY_ATTACK_COOLDOWN, ENEMY_CHASE_SPEED,
} from '../constants/combat.js'

// Loses aggro once the target strays this much further than the range that
// triggered it — a little hysteresis so an enemy doesn't flicker chase/idle
// when a player sits right at the aggro boundary.
const DEAGGRO_MULTIPLIER = 1.5

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function nearestPlayer(pos, players) {
  let best = null
  let bestDist = Infinity
  for (const p of players) {
    const d = dist(pos, p.position)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best ? { player: best, dist: bestDist } : null
}

function moveToward(pos, target, speed, dt) {
  const dx = target.x - pos.x
  const dz = target.z - pos.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05) return { ...pos }
  const step = Math.min(speed * dt, d)
  return { x: pos.x + (dx / d) * step, y: pos.y, z: pos.z + (dz / d) * step }
}

// Pure, immutable (same style as resources.js) — one enemy's AI, one tick.
// No wandering/randomness in v1: an enemy stands still (`idle`) until a
// player enters aggro range, then chases and attacks with a telegraphed
// windup (docs/spec.md §7 — latency-tolerant by design, not a twitch system).
// `players` = [{ id, position }]. Returns a NEW enemy object; `justAttacked`
// tells the caller (Scene.js) to actually apply damage this tick.
export function stepEnemy(enemy, players, dt) {
  if (enemy.state === 'attackWindup') {
    const stateTimer = enemy.stateTimer - dt
    if (stateTimer > 0) return { ...enemy, stateTimer, justAttacked: false }
    const target = players.find((p) => p.id === enemy.targetId)
    const inRange = !!target && dist(enemy.position, target.position) <= ENEMY_ATTACK_RANGE
    return { ...enemy, state: 'attackCooldown', stateTimer: ENEMY_ATTACK_COOLDOWN, justAttacked: inRange }
  }

  if (enemy.state === 'attackCooldown') {
    const stateTimer = enemy.stateTimer - dt
    if (stateTimer > 0) return { ...enemy, stateTimer, justAttacked: false }
    return { ...enemy, state: 'chase', stateTimer: 0, justAttacked: false }
  }

  const near = nearestPlayer(enemy.position, players)

  if (enemy.state === 'chase') {
    if (!near || near.dist > ENEMY_AGGRO_RANGE * DEAGGRO_MULTIPLIER) {
      return { ...enemy, state: 'idle', targetId: null, justAttacked: false }
    }
    if (near.dist <= ENEMY_ATTACK_RANGE) {
      return {
        ...enemy,
        state: 'attackWindup',
        stateTimer: ENEMY_ATTACK_WINDUP,
        targetId: near.player.id,
        justAttacked: false,
      }
    }
    return {
      ...enemy,
      targetId: near.player.id,
      position: moveToward(enemy.position, near.player.position, ENEMY_CHASE_SPEED, dt),
      justAttacked: false,
    }
  }

  // idle
  if (near && near.dist <= ENEMY_AGGRO_RANGE) {
    return { ...enemy, state: 'chase', targetId: near.player.id, justAttacked: false }
  }
  return { ...enemy, justAttacked: false }
}
