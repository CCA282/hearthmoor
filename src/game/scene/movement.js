// Pure movement math, no THREE/DOM dependency — see camera.js for the same
// rationale. Movement stays relative to the world (not the camera), per
// docs/spec.md §3: a "forward" input always moves the same world direction
// regardless of the fixed semi-isometric camera angle.

export function combineMoveVectors(a, b) {
  return { x: a.x + b.x, z: a.z + b.z }
}

// Caps magnitude at 1 (e.g. keyboard diagonals), but never rescales *up* — a
// half-pushed analog stick should still move at half speed.
export function clampToUnit(v) {
  const len = Math.hypot(v.x, v.z)
  if (len <= 1 || len === 0) return v
  return { x: v.x / len, z: v.z / len }
}

export function stepPosition(pos, dir, speed, dt) {
  return { x: pos.x + dir.x * speed * dt, y: pos.y, z: pos.z + dir.z * speed * dt }
}
