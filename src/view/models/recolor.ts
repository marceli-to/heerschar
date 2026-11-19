import * as THREE from 'three';

/**
 * KayKit textures are swatch atlases: 8 columns x 4 rows of vertical gradients, one per colour
 * of the character (cape, hat, trim ...). A swap repaints one swatch in a new colour and keeps
 * its gradient, so the model's shading stays as drawn. game-pack-generator palettes are 8 x 8
 * flat cells (`rows: 8`); on a flat cell the swap lands exactly on the new colour.
 */
export interface Swap {
  /** Swatch column 0..7 and row 0..rows-1 (row 0 at the top, as in the image and the glTF UVs). */
  cell: readonly [number, number];
  color: string;
  /** Rows of the atlas: 4 (KayKit, the default) or 8 (gpg palette). */
  rows?: number;
}

const cache = new Map<string, THREE.Texture>();

/** The texture with the swaps applied; one per (source, swaps), shared by every unit that wears it. */
export function recolored(src: THREE.Texture, swaps: readonly Swap[], key: string): THREE.Texture {
  if (swaps.length === 0) return src;
  const hit = cache.get(key);
  if (hit) return hit;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const cw = img.width / 8;
  const hsl = { h: 0, s: 0, l: 0 };
  const target = { h: 0, s: 0, l: 0 };
  const c = new THREE.Color();
  const rgb = { r: 0, g: 0, b: 0 };
  for (const swap of swaps) {
    const [col, row] = swap.cell;
    const ch = img.height / (swap.rows ?? 4);
    const data = ctx.getImageData(col * cw, row * ch, cw, ch);
    const px = data.data;
    // Mean lightness of the swatch, so the new colour sits at its own lightness.
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      c.setRGB(px[i]! / 255, px[i + 1]! / 255, px[i + 2]! / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
      sum += hsl.l;
    }
    const mean = sum / (px.length / 4);
    new THREE.Color(swap.color).getHSL(target, THREE.SRGBColorSpace);
    for (let i = 0; i < px.length; i += 4) {
      c.setRGB(px[i]! / 255, px[i + 1]! / 255, px[i + 2]! / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
      const l = THREE.MathUtils.clamp(target.l + (hsl.l - mean), 0, 1);
      c.setHSL(target.h, target.s, l, THREE.SRGBColorSpace).getRGB(rgb, THREE.SRGBColorSpace);
      px[i] = Math.round(rgb.r * 255);
      px[i + 1] = Math.round(rgb.g * 255);
      px[i + 2] = Math.round(rgb.b * 255);
    }
    ctx.putImageData(data, col * cw, row * ch);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = src.flipY;
  tex.colorSpace = src.colorSpace;
  tex.magFilter = src.magFilter;
  tex.minFilter = src.minFilter;
  tex.wrapS = src.wrapS;
  tex.wrapT = src.wrapT;
  tex.generateMipmaps = src.generateMipmaps;
  cache.set(key, tex);
  return tex;
}
