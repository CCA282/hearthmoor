import { describe, it, expect, vi } from 'vitest'

// engine.js constructs an Input(), which registers real DOM listeners, and
// transitively imports netState.js, which reads localStorage — stub just
// enough of `window`/`localStorage` for that import chain to run under
// vitest's `node` environment (see vite.config.js). We never call
// engine.start()/stop() here, so the WebGLRenderer/canvas path (the actual
// reason engine.js stays wiring-only/untested beyond this) is never exercised.
vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const { engine } = await import('../game/engine.js')

describe('engine.newGame', () => {
  it('replaces the scene with a fresh one', () => {
    const before = engine.scene
    engine.newGame()
    expect(engine.scene).not.toBe(before)
    expect(engine.scene.localPlayer.position).toEqual({ x: 3, y: 0.9, z: 3 })
  })

  it('does not carry over state from the previous game (e.g. a depleted node)', () => {
    engine.newGame()
    engine.scene.nodes[0].depleted = true
    engine.newGame()
    expect(engine.scene.nodes[0].depleted).toBe(false)
  })

  it('applies a loaded snapshot onto the fresh scene when one is given', () => {
    const snapshot = {
      players: [{
        id: 'local', x: 5, y: 0.9, z: -1, inventory: [{ itemId: 'wood', count: 7 }],
        equipment: { weapon: 'hache_bois' }, health: 80,
      }],
      nodes: [],
      enemies: [],
    }
    engine.newGame(snapshot)
    expect(engine.scene.localPlayer.position).toEqual({ x: 5, y: 0.9, z: -1 })
    expect(engine.scene.localPlayer.inventory).toEqual([{ itemId: 'wood', count: 7 }])
    expect(engine.scene.localPlayer.equipment).toEqual({ weapon: 'hache_bois' })
    expect(engine.scene.localPlayer.health).toBe(80)
  })

  it('resets the host sync timers and any pending guest input', () => {
    engine._syncTimer = 5
    engine._inputTimer = 5
    engine._pendingAction = true
    engine._pendingAttack = true
    engine.newGame()
    expect(engine._syncTimer).toBe(0)
    expect(engine._inputTimer).toBe(0)
    expect(engine._pendingAction).toBe(false)
    expect(engine._pendingAttack).toBe(false)
  })
})
