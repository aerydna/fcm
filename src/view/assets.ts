import houseUrl from './art/house.svg?url';
import houseLightsUrl from './art/house-lights.svg?url';
import softdrinkUrl from './art/drink-softdrink.svg?url';
import beerUrl from './art/drink-beer.svg?url';
import lemonadeUrl from './art/drink-lemonade.svg?url';
import { Assets, Texture } from 'pixi.js';

/** Logical asset key -> file. Swap art by changing this map only. */
export const ASSET_MANIFEST = {
  house: houseUrl,
  houseLights: houseLightsUrl,
  'drink-softdrink': softdrinkUrl,
  'drink-beer': beerUrl,
  'drink-lemonade': lemonadeUrl,
} as const;

export type AssetKey = keyof typeof ASSET_MANIFEST;

export async function loadAssets(): Promise<Record<AssetKey, Texture>> {
  const entries = await Promise.all(
    (Object.keys(ASSET_MANIFEST) as AssetKey[]).map(async (key) => {
      const texture = await Assets.load<Texture>({ src: ASSET_MANIFEST[key], data: { resolution: 3 } });
      return [key, texture] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<AssetKey, Texture>;
}

/** Soft radial light used for lamps, windows and headlights. */
export function makeGlowTexture(size = 128): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}
