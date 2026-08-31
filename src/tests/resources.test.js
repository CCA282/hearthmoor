import { describe, it, expect } from 'vitest'
import { findNearestNode, hitNode, tickNodeRespawn } from '../game/scene/resources.js'
import { NODE_HP, NODE_RESPAWN_TIME } from '../game/constants/nodes.js'

function node(id, x, z, overrides = {}) {
  return { id, kind: 'tree', item: 'wood', x, z, depleted: false, ...overrides }
}

describe('findNearestNode', () => {
  it('returns null when no nodes are within range', () => {
    const nodes = [node('a', 10, 10)]
    expect(findNearestNode(nodes, { x: 0, z: 0 }, 2)).toBeNull()
  })

  it('returns the only node within range', () => {
    const nodes = [node('a', 1, 0)]
    expect(findNearestNode(nodes, { x: 0, z: 0 }, 2)?.id).toBe('a')
  })

  it('returns the closest of several nodes within range', () => {
    const nodes = [node('far', 1.8, 0), node('near', 0.5, 0)]
    expect(findNearestNode(nodes, { x: 0, z: 0 }, 2)?.id).toBe('near')
  })

  it('ignores depleted nodes even if closer', () => {
    const nodes = [node('depleted', 0.2, 0, { depleted: true }), node('active', 1.5, 0)]
    expect(findNearestNode(nodes, { x: 0, z: 0 }, 2)?.id).toBe('active')
  })

  it('is inclusive at the exact range boundary', () => {
    const nodes = [node('edge', 2, 0)]
    expect(findNearestNode(nodes, { x: 0, z: 0 }, 2)?.id).toBe('edge')
  })

  it('returns null for an empty node list', () => {
    expect(findNearestNode([], { x: 0, z: 0 }, 2)).toBeNull()
  })
})

describe('hitNode', () => {
  it('decrements hp without depleting when hp remains above 0', () => {
    const n = hitNode(node('a', 0, 0, { hp: NODE_HP }))
    expect(n.hp).toBe(NODE_HP - 1)
    expect(n.depleted).toBe(false)
  })

  it('depletes and starts the respawn timer once hp reaches 0', () => {
    const n = hitNode(node('a', 0, 0, { hp: 1 }))
    expect(n.hp).toBe(0)
    expect(n.depleted).toBe(true)
    expect(n.respawnTimer).toBe(NODE_RESPAWN_TIME)
  })

  it('does not mutate the input node (immutable)', () => {
    const original = node('a', 0, 0, { hp: NODE_HP })
    hitNode(original)
    expect(original.hp).toBe(NODE_HP)
  })

  it('never lets hp go negative', () => {
    const n = hitNode(node('a', 0, 0, { hp: 1 }))
    expect(n.hp).toBe(0)
  })
})

describe('tickNodeRespawn', () => {
  it('is a no-op (same reference) on a node that is not depleted', () => {
    const n = node('a', 0, 0, { depleted: false })
    expect(tickNodeRespawn(n, 1)).toBe(n)
  })

  it('counts down the respawn timer without resetting while time remains', () => {
    const n = tickNodeRespawn(node('a', 0, 0, { depleted: true, respawnTimer: 5 }), 2)
    expect(n.depleted).toBe(true)
    expect(n.respawnTimer).toBe(3)
  })

  it('resets to full hp and clears depleted once the timer elapses', () => {
    const n = tickNodeRespawn(node('a', 0, 0, { depleted: true, respawnTimer: 1, hp: 0 }), 2)
    expect(n.depleted).toBe(false)
    expect(n.hp).toBe(NODE_HP)
  })

  it('resets exactly when the timer hits zero', () => {
    const n = tickNodeRespawn(node('a', 0, 0, { depleted: true, respawnTimer: 2, hp: 0 }), 2)
    expect(n.depleted).toBe(false)
  })
})
