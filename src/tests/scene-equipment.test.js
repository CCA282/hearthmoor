import { describe, it, expect } from 'vitest'
import { Scene } from '../game/scene/Scene.js'
import { PLAYER_ATTACK_DAMAGE, ENEMY_MAX_HEALTH } from '../game/constants/combat.js'
import { addItem, totalCount } from '../game/inventory.js'
import { game } from '../game/store.js'

// Same rationale as scene-snapshot.test.js: THREE doesn't need a browser to
// construct/update, so these orchestration-level behaviors (crafting,
// equipping, and how that feeds into combat) are tested against a real Scene
// rather than a hand-rolled stand-in.

describe('Scene — attack damage reflects the equipped weapon', () => {
  it('deals base damage with nothing equipped', () => {
    const scene = new Scene()
    const enemy = scene.enemies[0]
    scene._attackFor(scene.localPlayer, enemy)
    expect(enemy.health).toBe(ENEMY_MAX_HEALTH - PLAYER_ATTACK_DAMAGE)
  })

  it('deals extra damage once the axe is equipped', () => {
    const scene = new Scene()
    scene.localPlayer.equipment.weapon = 'hache_bois'
    const enemy = scene.enemies[0]
    scene._attackFor(scene.localPlayer, enemy)
    expect(enemy.health).toBe(ENEMY_MAX_HEALTH - (PLAYER_ATTACK_DAMAGE + 10))
  })
})

describe('Scene — crafting at the workbench', () => {
  it('does nothing without enough materials', () => {
    const scene = new Scene()
    const recipe = { output: 'hache_bois', cost: { wood: 15 } }
    scene._craftFor(scene.localPlayer, recipe)
    expect(totalCount(scene.localPlayer.inventory, 'hache_bois')).toBe(0)
    expect(scene.localPlayer.equipment.weapon).toBeNull()
  })

  it('consumes materials, adds the item, and auto-equips it', () => {
    const scene = new Scene()
    scene.localPlayer.inventory = addItem(scene.localPlayer.inventory, 'wood', 20).inventory
    const recipe = { output: 'hache_bois', cost: { wood: 15 } }

    scene._craftFor(scene.localPlayer, recipe)

    expect(totalCount(scene.localPlayer.inventory, 'wood')).toBe(5)
    expect(totalCount(scene.localPlayer.inventory, 'hache_bois')).toBe(1)
    expect(scene.localPlayer.equipment.weapon).toBe('hache_bois')
  })

  it('does not re-equip if the slot is already filled (leaves the existing choice alone)', () => {
    const scene = new Scene()
    scene.localPlayer.equipment.weapon = 'hache_bois'
    scene.localPlayer.inventory = addItem(scene.localPlayer.inventory, 'wood', 20).inventory
    const recipe = { output: 'hache_bois', cost: { wood: 15 } }

    scene._craftFor(scene.localPlayer, recipe)

    // Crafted a spare, but the already-equipped weapon reference is untouched.
    expect(totalCount(scene.localPlayer.inventory, 'hache_bois')).toBe(1)
    expect(scene.localPlayer.equipment.weapon).toBe('hache_bois')
  })

  it('syncs the local player HUD mirror (inventory + equipment) after crafting', () => {
    const scene = new Scene()
    scene.localPlayer.inventory = addItem(scene.localPlayer.inventory, 'wood', 20).inventory
    scene._craftFor(scene.localPlayer, { output: 'hache_bois', cost: { wood: 15 } })
    expect(game.equipment.weapon).toBe('hache_bois')
    expect(totalCount(game.inventory, 'hache_bois')).toBe(1)
  })
})
