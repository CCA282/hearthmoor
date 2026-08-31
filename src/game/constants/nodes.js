// Resource node placements for the Prairie zone (spawn zone) — see
// docs/spec.md §5. Positions are world-space {x, z}, hand-placed around the
// camp (0,0). More zones/node types land as they get built.
export const RESOURCE_NODES = [
  { id: 'tree-1', kind: 'tree', item: 'wood', x: -7, z: -5 },
  { id: 'tree-2', kind: 'tree', item: 'wood', x: -10, z: 3 },
  { id: 'tree-3', kind: 'tree', item: 'wood', x: -4, z: 8 },
  { id: 'rock-1', kind: 'rock', item: 'stone', x: 7, z: -6 },
  { id: 'rock-2', kind: 'rock', item: 'stone', x: 9, z: 4 },
]

export const NODE_HP = 3          // hits before a node depletes
export const NODE_YIELD_PER_HIT = 1
export const NODE_RESPAWN_TIME = 8 // seconds before a depleted node respawns
export const HARVEST_RANGE = 2.4   // world units
