import * as THREE from 'three'
import { CAMERA_FRUSTUM_SIZE, CAMERA_NEAR, CAMERA_FAR } from '../constants/camera.js'
import { cameraPositionFor } from './camera.js'

// Semi-isometric fixed-angle camera, low-poly ground + simple lighting/fog —
// see docs/spec.md §3-4. No renderer here: WebGLRenderer needs a real <canvas>
// and is owned by engine.js, so this class stays constructible (and mostly
// testable) outside a browser too.
export class Scene {
  constructor() {
    this.three = new THREE.Scene()
    this.three.background = new THREE.Color('#12181c')
    this.three.fog = new THREE.Fog('#12181c', 26, 70)

    this._setupLights()
    this._setupGround()
    this._setupHearthMarker()

    // What the camera follows — the player, once it exists (next task).
    this.cameraTarget = { x: 0, y: 0, z: 0 }
    this.camera = this._createCamera()
    this._updateCamera()
  }

  _createCamera() {
    const s = CAMERA_FRUSTUM_SIZE
    const camera = new THREE.OrthographicCamera(-s, s, s, -s, CAMERA_NEAR, CAMERA_FAR)
    return camera
  }

  // Called by engine.js on resize — keeps the frustum height fixed (constant
  // zoom) while adapting width to the canvas aspect ratio.
  setAspect(aspect) {
    const s = CAMERA_FRUSTUM_SIZE
    this.camera.left = -s * aspect
    this.camera.right = s * aspect
    this.camera.top = s
    this.camera.bottom = -s
    this.camera.updateProjectionMatrix()
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight('#8fa8ad', 0.7)
    const sun = new THREE.DirectionalLight('#fff3d6', 1.1)
    sun.position.set(8, 14, 6)
    this.three.add(ambient, sun)
  }

  _setupGround() {
    const geo = new THREE.PlaneGeometry(160, 160)
    const mat = new THREE.MeshLambertMaterial({ color: '#4c6152' })
    const ground = new THREE.Mesh(geo, mat)
    ground.rotation.x = -Math.PI / 2
    this.three.add(ground)
  }

  // Temporary visual anchor at the camp's spawn point (0,0,0) — placeholder
  // for the real hearth/campfire prop, useful in the meantime to eyeball that
  // the ground/camera/lighting are actually oriented correctly.
  _setupHearthMarker() {
    const geo = new THREE.ConeGeometry(0.8, 1.6, 6)
    const mat = new THREE.MeshLambertMaterial({ color: '#e8974a' })
    const marker = new THREE.Mesh(geo, mat)
    marker.position.set(0, 0.8, 0)
    this.three.add(marker)
  }

  _updateCamera() {
    const pos = cameraPositionFor(this.cameraTarget)
    this.camera.position.set(pos.x, pos.y, pos.z)
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z)
  }

  update(_dt, _input) {
    this._updateCamera()
  }
}
