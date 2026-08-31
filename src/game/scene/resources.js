import { NODE_HP, NODE_RESPAWN_TIME } from '../constants/nodes.js'

// Pure, no THREE/DOM dependency — same rationale as camera.js/movement.js.
// Returns the closest non-depleted node within range, or null.
export function findNearestNode(nodes, playerPos, range) {
  let best = null
  let bestDist = range
  for (const n of nodes) {
    if (n.depleted) continue
    const d = Math.hypot(n.x - playerPos.x, n.z - playerPos.z)
    if (d <= bestDist) {
      bestDist = d
      best = n
    }
  }
  return best
}

// Pure — applies one harvest hit to a node-like object ({ hp, depleted,
// respawnTimer }), returns a NEW object (immutable, same style as
// inventory.js/movement.js). Depletes the node once hp reaches 0.
export function hitNode(node) {
  const hp = node.hp - 1
  if (hp <= 0) return { ...node, hp: 0, depleted: true, respawnTimer: NODE_RESPAWN_TIME }
  return { ...node, hp }
}

// Pure — advances a depleted node's respawn timer; resets it (full hp, no
// longer depleted) once the timer elapses. Returns the same reference
// (no-op) on a node that isn't depleted, so callers can cheaply detect "did
// anything change" via reference equality.
export function tickNodeRespawn(node, dt) {
  if (!node.depleted) return node
  const respawnTimer = node.respawnTimer - dt
  if (respawnTimer <= 0) return { ...node, depleted: false, hp: NODE_HP, respawnTimer: 0 }
  return { ...node, respawnTimer }
}
