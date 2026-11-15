import * as THREE from 'three';
import type { RegionId } from '../data/campaign';
import { GRADE } from './palette';
import { REGION_LOOKS, type RegionLook } from './scenery/looks';

export interface SceneParts {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
}

/** Renderer, sky dome, fog and lights in the region's look (6d). Shadows only cover the arena so the map stays sharp. */
export function createScene(canvas: HTMLCanvasElement, region: RegionId = 'greenmarch'): SceneParts {
  const look = REGION_LOOKS[region];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(look.fog.color, look.fog.near, look.fog.far);
  scene.add(createSky(look));

  const hemi = new THREE.HemisphereLight(look.hemi.sky, look.hemi.ground, look.hemi.intensity);
  scene.add(hemi);

  // Greenmarch: afternoon sun from the south-west, high enough that shadows stay short and readable.
  const sun = new THREE.DirectionalLight(look.sun.color, look.sun.intensity);
  sun.position.set(...look.sun.position);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -32;
  s.right = 32;
  s.top = 26;
  s.bottom = -26;
  s.near = 10;
  s.far = 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = GRADE.shadowRadius;
  scene.add(sun, sun.target);

  return { renderer, scene, sun };
}

function createSky(look: RegionLook): THREE.Mesh {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(look.sky.zenith) },
      horizon: { value: new THREE.Color(look.sky.horizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.55)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
