import * as THREE from 'three';
import { FX } from './palette';
import type { Team } from '../sim/types';

/** Shield bubble: bright at the rim, nearly clear in the middle, so the figure stays readable. */
function shieldMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);
        gl_FragColor = vec4(color, (0.04 + rim * 0.75) * opacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** The shield bubble around a shielded unit, fading in and out. */
export class ShieldBubble {
  readonly mesh: THREE.Mesh;
  private level = 0;

  constructor(team: Team, scale: THREE.Vector3Like = { x: 0.75, y: 1.15, z: 0.75 }, y = 1.0) {
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), shieldMaterial(team === 'player' ? FX.shieldPlayer : FX.shieldEnemy));
    this.mesh.scale.set(scale.x, scale.y, scale.z);
    this.mesh.position.y = y;
    this.mesh.visible = false;
  }

  update(on: boolean, frameTime: number, time: number): void {
    this.level += ((on ? 1 : 0) - this.level) * Math.min(1, frameTime * 10);
    this.mesh.visible = this.level > 0.02;
    if (this.mesh.visible) (this.mesh.material as THREE.ShaderMaterial).uniforms.opacity!.value = this.level * (0.85 + Math.sin(time * 4) * 0.15);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
