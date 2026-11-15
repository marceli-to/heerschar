import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NanProbe } from './nanProbe';

/**
 * Warm grade in linear HDR, before tone mapping: warmer gain, a touch of lift in the shadows,
 * slightly richer saturation and a soft vignette.
 */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uAmount; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 g = c.rgb * vec3(1.07, 1.0, 0.88) + vec3(0.010, 0.006, 0.0);
      float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
      g = mix(vec3(l), g, 1.1);
      vec2 d = vUv - 0.5;
      g *= 1.0 - dot(d, d) * 0.6;
      gl_FragColor = vec4(mix(c.rgb, g, uAmount), c.a);
    }`,
};

export class Post {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;

  /** Debug only: watches the scene buffer for NaN / Infinity pixels (see `nanProbe.ts`). */
  readonly nanProbe: NanProbe | null;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { nanProbe?: boolean } = {}) {
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.nanProbe = opts.nanProbe ? new NanProbe(scene, camera) : null;
    if (this.nanProbe) this.composer.addPass(this.nanProbe);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.6, 0.4, 1.3);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /** Bloom on / off and the MSAA sample count of the scene target (quality presets). */
  setQuality(bloom: boolean, samples: number): void {
    this.bloom.enabled = bloom;
    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (t.samples === samples) continue;
      t.samples = samples;
      t.dispose(); // reallocated with the new sample count on the next render
    }
  }

  dispose(): void {
    this.composer.dispose();
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
