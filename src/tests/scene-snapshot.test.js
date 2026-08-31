import { describe, it, expect } from 'vitest'
import { Scene } from '../game/scene/Scene.js'
import { addItem } from '../game/inventory.js'

// Scene doesn't need a real <canvas>/WebGL context to construct or to run its
// non-rendering logic (THREE.Scene/Mesh/Geometry/Camera are plain JS objects)
// — only WebGLRenderer (owned by engine.js) needs a browser. That means the
// snapshot logic can be tested against a real Scene instance rather than a
// hand-rolled stand-in, unlike the movement/resources pure functions which
// stay separate on their own merit (reused by both local and network paths).

describe('Scene — serializeSnapshot', () => {
  it('includes the local player with their position and inventory', () => {
    const scene = new Scene()
    scene.localPlayer.position = { x: 5, y: 0.9, z: -2 }
    const { inventory } = addItem(scene.localPlayer.inventory, 'wood', 3)
    scene.localPlayer.inventory = inventory

    const snap = scene.serializeSnapshot()
    const p = snap.players.find((x) => x.id === scene.localPlayerId)
    expect(p).toMatchObject({ x: 5, y: 0.9, z: -2 })
    expect(p.inventory[0]).toEqual({ itemId: 'wood', count: 3 })
  })

  it('includes every node with its harvest state', () => {
    const scene = new Scene()
    const snap = scene.serializeSnapshot()
    expect(snap.nodes.length).toBe(scene.nodes.length)
    expect(snap.nodes[0]).toMatchObject({ hp: expect.any(Number), depleted: false })
  })

  it('includes remote players added via addPlayer', () => {
    const scene = new Scene()
    scene.addPlayer('guest-1', { x: 1, y: 0.9, z: 1 })
    const snap = scene.serializeSnapshot()
    expect(snap.players.map((p) => p.id)).toEqual(expect.arrayContaining(['local', 'guest-1']))
  })
})

describe('Scene — applySnapshot', () => {
  function baseSnap(scene, overrides = {}) {
    return {
      players: [{ id: scene.localPlayerId, x: 0, y: 0.9, z: 0, inventory: [] }],
      nodes: scene.nodes.map((n) => ({ id: n.id, hp: n.hp, depleted: false, respawnTimer: 0 })),
      ...overrides,
    }
  }

  it('moves an existing player to the received position', () => {
    const scene = new Scene()
    const snap = baseSnap(scene, {
      players: [{ id: scene.localPlayerId, x: 9, y: 0.9, z: -4, inventory: [] }],
    })
    scene.applySnapshot(snap)
    expect(scene.localPlayer.position).toEqual({ x: 9, y: 0.9, z: -4 })
    expect(scene.localPlayer.mesh.position.x).toBe(9)
  })

  it('creates a new player entry for someone not seen before', () => {
    const scene = new Scene()
    scene.applySnapshot(baseSnap(scene, {
      players: [
        { id: scene.localPlayerId, x: 0, y: 0.9, z: 0, inventory: [] },
        { id: 'guest-1', x: 2, y: 0.9, z: 2, inventory: [] },
      ],
    }))
    expect(scene.findPlayer('guest-1')).toBeTruthy()
    expect(scene.findPlayer('guest-1').position).toEqual({ x: 2, y: 0.9, z: 2 })
  })

  it('removes a player who left (no longer in the snapshot)', () => {
    const scene = new Scene()
    scene.addPlayer('guest-1', { x: 0, y: 0, z: 0 })
    expect(scene.findPlayer('guest-1')).toBeTruthy()

    scene.applySnapshot(baseSnap(scene)) // guest-1 absent from this snapshot
    expect(scene.findPlayer('guest-1')).toBeNull()
  })

  it('replaces the inventory with the received one', () => {
    const scene = new Scene()
    scene.applySnapshot(baseSnap(scene, {
      players: [{ id: scene.localPlayerId, x: 0, y: 0.9, z: 0, inventory: [{ itemId: 'stone', count: 4 }] }],
    }))
    expect(scene.localPlayer.inventory[0]).toEqual({ itemId: 'stone', count: 4 })
  })

  it('syncs node hp/depleted/respawnTimer and hides depleted meshes', () => {
    const scene = new Scene()
    const target = scene.nodes[0]
    scene.applySnapshot(baseSnap(scene, {
      nodes: scene.nodes.map((n) => (
        n.id === target.id ? { id: n.id, hp: 0, depleted: true, respawnTimer: 5 } : { id: n.id, hp: n.hp, depleted: false, respawnTimer: 0 }
      )),
    }))
    expect(target.depleted).toBe(true)
    expect(target.respawnTimer).toBe(5)
    expect(target.mesh.visible).toBe(false)
  })
})

describe('Scene — setLocalPlayerId', () => {
  it('updates localPlayerId', () => {
    const scene = new Scene()
    scene.addPlayer('guest-1', { x: 0, y: 0, z: 0 })
    scene.setLocalPlayerId('guest-1')
    expect(scene.localPlayerId).toBe('guest-1')
    expect(scene.localPlayer.id).toBe('guest-1')
  })

  it('recolors the mesh of a player entry created before we knew our own id (join race)', () => {
    const scene = new Scene()
    // Simulate a `state` broadcast creating our own player before joinRoomAsGuest() resolved.
    const early = scene.addPlayer('guest-1', { x: 0, y: 0, z: 0 })
    const remoteColor = early.mesh.material.color.getHexString()

    scene.setLocalPlayerId('guest-1')
    expect(early.mesh.material.color.getHexString()).not.toBe(remoteColor)
  })
})
