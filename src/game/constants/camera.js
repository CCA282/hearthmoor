// Semi-isometric fixed camera (see docs/spec.md §3) — offset from the followed
// target (the player), roughly a 45° azimuth / ~45° elevation angle.
export const CAMERA_OFFSET = { x: 12, y: 16, z: 12 }

// Orthographic frustum half-height, in world units — controls zoom level.
export const CAMERA_FRUSTUM_SIZE = 14
export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 200
