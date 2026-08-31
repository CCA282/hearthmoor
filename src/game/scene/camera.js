import { CAMERA_OFFSET } from '../constants/camera.js'

// Pure math, no THREE/DOM dependency — kept separate from Scene.js (which wires
// this into an actual THREE.Camera) so the camera-follow logic is trivially
// unit-testable without a WebGL context.
export function cameraPositionFor(target, offset = CAMERA_OFFSET) {
  return {
    x: target.x + offset.x,
    y: (target.y ?? 0) + offset.y,
    z: target.z + offset.z,
  }
}
