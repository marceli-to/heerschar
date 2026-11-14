<script setup lang="ts">
import * as THREE from 'three';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ClassId } from '../../sim/types';
import { PLAYER_COLORS } from '../../view/palette';
import { PrimitiveFigureView } from '../../view/unitView';

/** A class figure turning slowly on parchment (approved 3): its own small transparent renderer. */
const props = withDefaults(defineProps<{ classId: ClassId; hero?: boolean }>(), { hero: true });

const canvas = ref<HTMLCanvasElement | null>(null);
let renderer: THREE.WebGLRenderer | null = null;
let view: PrimitiveFigureView | null = null;
let frame = 0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
camera.position.set(0, 1.35, 5.4);
camera.lookAt(0, 0.95, 0);
scene.add(new THREE.HemisphereLight('#fff1d6', '#6b5137', 1.4));
const key = new THREE.DirectionalLight('#ffd9a0', 2.6);
key.position.set(-3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight('#ffe8c0', 1.2);
rim.position.set(3, 3, -4);
scene.add(rim);

function build(): void {
  if (view) {
    scene.remove(view.root);
    view.dispose();
  }
  view = new PrimitiveFigureView(props.classId, PLAYER_COLORS, 'player', props.hero);
  scene.add(view.root);
}

function resize(): void {
  if (!renderer || !canvas.value) return;
  const { clientWidth: w, clientHeight: h } = canvas.value;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

let last = 0;
let turn = 0.5;
function loop(now: number): void {
  frame = requestAnimationFrame(loop);
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
  last = now;
  turn += dt * 0.5;
  if (view) {
    view.setPose(0, 0, turn);
    view.animate({ state: 'idle', stateTime: 0, chain: 0, stunDuration: 0, isHero: props.hero, action: null, windup: 0, recover: 0, speed: 0, frozen: false, shielded: false }, dt);
  }
  renderer?.render(scene, camera);
}

const ro = new ResizeObserver(resize);
onMounted(() => {
  if (!canvas.value) return;
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  build();
  ro.observe(canvas.value);
  resize();
  frame = requestAnimationFrame(loop);
});

watch(() => [props.classId, props.hero], build);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  ro.disconnect();
  view?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
});
</script>

<template>
  <div class="relative">
    <!-- a soft shadow under the feet -->
    <div class="absolute bottom-[9%] left-1/2 h-[7%] w-[46%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgb(58_39_23/0.45),transparent_70%)]" />
    <canvas ref="canvas" class="relative block h-full w-full" />
  </div>
</template>
