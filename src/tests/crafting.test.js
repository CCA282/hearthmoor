import { describe, it, expect } from 'vitest'
import { canAffordRecipe, craftRecipe } from '../game/crafting.js'
import { createInventory, addItem, totalCount } from '../game/inventory.js'

const AXE_RECIPE = { output: 'hache_bois', cost: { wood: 15 } }
const TWO_COST_RECIPE = { output: 'hache_bois', cost: { wood: 10, stone: 5 } }

describe('canAffordRecipe', () => {
  it('is false with an empty inventory', () => {
    expect(canAffordRecipe(createInventory(), AXE_RECIPE)).toBe(false)
  })

  it('is false when short of the required amount', () => {
    const inv = addItem(createInventory(), 'wood', 10).inventory
    expect(canAffordRecipe(inv, AXE_RECIPE)).toBe(false)
  })

  it('is true with exactly enough', () => {
    const inv = addItem(createInventory(), 'wood', 15).inventory
    expect(canAffordRecipe(inv, AXE_RECIPE)).toBe(true)
  })

  it('is true with more than enough', () => {
    const inv = addItem(createInventory(), 'wood', 20).inventory
    expect(canAffordRecipe(inv, AXE_RECIPE)).toBe(true)
  })

  it('requires every item in a multi-cost recipe', () => {
    let inv = addItem(createInventory(), 'wood', 10).inventory
    expect(canAffordRecipe(inv, TWO_COST_RECIPE)).toBe(false)
    inv = addItem(inv, 'stone', 5).inventory
    expect(canAffordRecipe(inv, TWO_COST_RECIPE)).toBe(true)
  })
})

describe('craftRecipe', () => {
  it('consumes the cost and adds the output', () => {
    const inv = addItem(createInventory(), 'wood', 20).inventory
    const crafted = craftRecipe(inv, AXE_RECIPE)
    expect(totalCount(crafted, 'wood')).toBe(5)
    expect(totalCount(crafted, 'hache_bois')).toBe(1)
  })

  it('does not mutate the input inventory', () => {
    const inv = addItem(createInventory(), 'wood', 20).inventory
    craftRecipe(inv, AXE_RECIPE)
    expect(totalCount(inv, 'wood')).toBe(20)
  })

  it('consumes every item in a multi-cost recipe', () => {
    let inv = addItem(createInventory(), 'wood', 10).inventory
    inv = addItem(inv, 'stone', 5).inventory
    const crafted = craftRecipe(inv, TWO_COST_RECIPE)
    expect(totalCount(crafted, 'wood')).toBe(0)
    expect(totalCount(crafted, 'stone')).toBe(0)
    expect(totalCount(crafted, 'hache_bois')).toBe(1)
  })
})
