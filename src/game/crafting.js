import { totalCount, removeItem, addItem } from './inventory.js'

// Pure — true if the inventory holds at least `recipe.cost` of every
// required item.
export function canAffordRecipe(inventory, recipe) {
  return Object.entries(recipe.cost).every(([itemId, amount]) => totalCount(inventory, itemId) >= amount)
}

// Pure, immutable (same style as inventory.js) — removes the recipe's cost
// and adds one of its output. Caller is expected to have checked
// canAffordRecipe() first; this doesn't re-check (removeItem silently
// removes "as much as it can" otherwise, which would craft for free).
export function craftRecipe(inventory, recipe) {
  let inv = inventory
  for (const [itemId, amount] of Object.entries(recipe.cost)) {
    inv = removeItem(inv, itemId, amount).inventory
  }
  return addItem(inv, recipe.output, 1).inventory
}
