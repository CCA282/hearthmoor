// Discrete stackable items — see docs/spec.md §8. Deliberate break from
// hamnet-village's global resource counters (game.wood += 1): each item lives
// in an inventory slot, not a compteur.
export const ITEMS = {
  wood: { name: 'Bois', maxStack: 20 },
  stone: { name: 'Pierre', maxStack: 20 },
  meat: { name: 'Viande', maxStack: 10 },

  // Equipment — tier 1 of 3 (docs/spec.md §7-8: hache/épée/arc/bouclier ×
  // bois-bronze/fer/argent). Only the tier-1 axe exists so far; the rest is
  // pure data work once combat/crafting are proven end to end. maxStack: 1
  // marks it as non-stackable gear rather than a resource.
  hache_bois: { name: 'Hache en bois', maxStack: 1, slot: 'weapon', damageBonus: 10 },
}
