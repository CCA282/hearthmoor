// Discrete stackable items — see docs/spec.md §8. Deliberate break from
// hamnet-village's global resource counters (game.wood += 1): each item lives
// in an inventory slot, not a compteur.
export const ITEMS = {
  wood: { name: 'Bois', maxStack: 20 },
  stone: { name: 'Pierre', maxStack: 20 },
}
