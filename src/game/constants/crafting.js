// A single fixed crafting spot near camp — see docs/spec.md §9 ("établi
// fixe, comme un BUILD_SPOTS"). One recipe for now (see constants/items.js —
// only the tier-1 axe exists); more recipes are pure data once this loop is
// proven, no new interaction code needed.
export const WORKBENCH_POSITION = { x: 2, y: 0, z: -2 }
export const CRAFT_RANGE = 2.2

export const RECIPES = [
  { output: 'hache_bois', cost: { wood: 15 } },
]
