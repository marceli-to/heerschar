import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0);
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _fore = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Two-bone IK for an arm built hanging along -y: points the upper arm and forearm so the hand
 * reaches `target` (in the arm's parent space). `pole` says which way the elbow bends.
 */
export function reach(arm: THREE.Object3D, fore: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, upper: number, lower: number): void {
  _dir.subVectors(target, arm.position);
  const d = THREE.MathUtils.clamp(_dir.length(), 0.05, (upper + lower) * 0.999);
  _dir.normalize();
  const cosA = THREE.MathUtils.clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1);
  const a = Math.acos(cosA);
  _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 0, 1).addScaledVector(_dir, -_dir.z);
  _perp.normalize();
  _elbow.copy(_dir).multiplyScalar(Math.cos(a)).addScaledVector(_perp, Math.sin(a));
  arm.quaternion.setFromUnitVectors(DOWN, _elbow);
  // Hand position relative to the elbow, then into the upper arm's frame.
  _fore.copy(_dir).multiplyScalar(d).addScaledVector(_elbow, -upper).normalize();
  _q.copy(arm.quaternion).invert();
  _fore.applyQuaternion(_q);
  fore.quaternion.setFromUnitVectors(DOWN, _fore);
}

/** Sets `prop` (child of `fore`'s hand) so it has orientation `desired` in the arm's parent space. */
export function orient(prop: THREE.Object3D, arm: THREE.Object3D, fore: THREE.Object3D, desired: THREE.Quaternion): void {
  _q.multiplyQuaternions(arm.quaternion, fore.quaternion).invert();
  prop.quaternion.multiplyQuaternions(_q, desired);
}
