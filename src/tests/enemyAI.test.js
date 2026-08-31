import { describe, it, expect } from 'vitest'
import { stepEnemy, findNearestEnemy } from '../game/scene/enemyAI.js'
import {
  ENEMY_AGGRO_RANGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_WINDUP, ENEMY_ATTACK_COOLDOWN, ENEMY_CHASE_SPEED,
  ENEMY_MAX_HEALTH,
} from '../game/constants/combat.js'

function enemy(overrides = {}) {
  return { id: 'e1', position: { x: 0, y: 0, z: 0 }, state: 'idle', stateTimer: 0, targetId: null, ...overrides }
}

function player(id, x, z) {
  return { id, position: { x, y: 0.9, z } }
}

describe('stepEnemy — idle', () => {
  it('stays idle and still when no player is nearby', () => {
    const e = stepEnemy(enemy(), [player('p1', 100, 100)], 0.1)
    expect(e.state).toBe('idle')
    expect(e.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('stays idle just outside aggro range', () => {
    const e = stepEnemy(enemy(), [player('p1', ENEMY_AGGRO_RANGE + 0.5, 0)], 0.1)
    expect(e.state).toBe('idle')
  })

  it('switches to chase once a player enters aggro range', () => {
    const e = stepEnemy(enemy(), [player('p1', ENEMY_AGGRO_RANGE - 0.5, 0)], 0.1)
    expect(e.state).toBe('chase')
    expect(e.targetId).toBe('p1')
  })

  it('is inclusive at the exact aggro boundary', () => {
    const e = stepEnemy(enemy(), [player('p1', ENEMY_AGGRO_RANGE, 0)], 0.1)
    expect(e.state).toBe('chase')
  })

  it('targets the nearest of several players', () => {
    const e = stepEnemy(enemy(), [player('far', 5, 0), player('near', 2, 0)], 0.1)
    expect(e.targetId).toBe('near')
  })
})

describe('stepEnemy — chase', () => {
  it('moves toward the target player at ENEMY_CHASE_SPEED', () => {
    // Player at x=5: within aggro range's deaggro margin, outside attack range.
    const e = stepEnemy(enemy({ state: 'chase', targetId: 'p1' }), [player('p1', 5, 0)], 1)
    expect(e.position.x).toBeCloseTo(ENEMY_CHASE_SPEED)
    expect(e.position.z).toBeCloseTo(0)
  })

  it('does not overshoot the target', () => {
    // Distance (2) is less than a full second's travel at ENEMY_CHASE_SPEED (3.2).
    const e = stepEnemy(enemy({ state: 'chase', targetId: 'p1' }), [player('p1', 2, 0)], 1)
    expect(e.position.x).toBeCloseTo(2)
  })

  it('drops back to idle once the player leaves well beyond aggro range', () => {
    const e = stepEnemy(enemy({ state: 'chase', targetId: 'p1' }), [player('p1', ENEMY_AGGRO_RANGE * 2, 0)], 0.1)
    expect(e.state).toBe('idle')
    expect(e.targetId).toBeNull()
  })

  it('drops to idle when the target player is no longer in the players list (disconnected)', () => {
    const e = stepEnemy(enemy({ state: 'chase', targetId: 'p1' }), [], 0.1)
    expect(e.state).toBe('idle')
  })

  it('switches to attackWindup once within attack range', () => {
    const e = stepEnemy(enemy({ state: 'chase', targetId: 'p1' }), [player('p1', ENEMY_ATTACK_RANGE - 0.1, 0)], 0.1)
    expect(e.state).toBe('attackWindup')
    expect(e.stateTimer).toBe(ENEMY_ATTACK_WINDUP)
  })
})

describe('stepEnemy — attackWindup', () => {
  it('counts down without attacking while time remains', () => {
    const e = stepEnemy(
      enemy({ state: 'attackWindup', stateTimer: ENEMY_ATTACK_WINDUP, targetId: 'p1' }),
      [player('p1', 1, 0)],
      0.1,
    )
    expect(e.state).toBe('attackWindup')
    expect(e.stateTimer).toBeCloseTo(ENEMY_ATTACK_WINDUP - 0.1)
    expect(e.justAttacked).toBe(false)
  })

  it('lands the hit (justAttacked) if the target is still in range when the timer elapses', () => {
    const e = stepEnemy(
      enemy({ state: 'attackWindup', stateTimer: 0.05, targetId: 'p1' }),
      [player('p1', ENEMY_ATTACK_RANGE - 0.1, 0)],
      0.1,
    )
    expect(e.justAttacked).toBe(true)
    expect(e.state).toBe('attackCooldown')
    expect(e.stateTimer).toBe(ENEMY_ATTACK_COOLDOWN)
  })

  it('whiffs (no justAttacked) if the target stepped out of range during the windup', () => {
    const e = stepEnemy(
      enemy({ state: 'attackWindup', stateTimer: 0.05, targetId: 'p1' }),
      [player('p1', ENEMY_ATTACK_RANGE + 2, 0)],
      0.1,
    )
    expect(e.justAttacked).toBe(false)
    expect(e.state).toBe('attackCooldown')
  })

  it('whiffs if the target disconnected mid-windup', () => {
    const e = stepEnemy(
      enemy({ state: 'attackWindup', stateTimer: 0.05, targetId: 'p1' }),
      [],
      0.1,
    )
    expect(e.justAttacked).toBe(false)
  })
})

describe('stepEnemy — attackCooldown', () => {
  it('counts down without re-attacking', () => {
    const e = stepEnemy(enemy({ state: 'attackCooldown', stateTimer: ENEMY_ATTACK_COOLDOWN }), [], 0.1)
    expect(e.state).toBe('attackCooldown')
    expect(e.justAttacked).toBe(false)
  })

  it('returns to chase once the cooldown elapses', () => {
    const e = stepEnemy(enemy({ state: 'attackCooldown', stateTimer: 0.05 }), [], 0.1)
    expect(e.state).toBe('chase')
  })
})

describe('stepEnemy — immutability', () => {
  it('does not mutate the input enemy', () => {
    const original = enemy({ state: 'chase', targetId: 'p1' })
    const frozen = JSON.parse(JSON.stringify(original))
    stepEnemy(original, [player('p1', 10, 0)], 1)
    expect(original).toEqual(frozen)
  })
})

describe('findNearestEnemy', () => {
  function livingEnemy(id, x, z) {
    return { id, position: { x, y: 0, z }, health: ENEMY_MAX_HEALTH }
  }

  it('returns null when nothing is within range', () => {
    expect(findNearestEnemy([livingEnemy('e1', 10, 10)], { x: 0, z: 0 }, 2)).toBeNull()
  })

  it('returns the closest of several enemies within range', () => {
    const enemies = [livingEnemy('far', 1.8, 0), livingEnemy('near', 0.5, 0)]
    expect(findNearestEnemy(enemies, { x: 0, z: 0 }, 2)?.id).toBe('near')
  })

  it('ignores dead enemies even if closer', () => {
    const enemies = [
      { ...livingEnemy('dead', 0.2, 0), health: 0 },
      livingEnemy('alive', 1.5, 0),
    ]
    expect(findNearestEnemy(enemies, { x: 0, z: 0 }, 2)?.id).toBe('alive')
  })

  it('is inclusive at the exact range boundary', () => {
    expect(findNearestEnemy([livingEnemy('edge', 2, 0)], { x: 0, z: 0 }, 2)?.id).toBe('edge')
  })
})
