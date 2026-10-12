import type { Application, Container, FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.2;

/** Pan (drag) and zoom (wheel, toward cursor) for the board container. */
export class Camera {
  private mode: 'menu' | 'game' = 'menu';
  private width = 1;
  private height = 1;
  private drag?: { x: number; y: number };
  private drift?: gsap.core.Tween;

  constructor(
    private readonly app: Application,
    private readonly world: Container,
  ) {
    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;
    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      if (this.mode === 'game') this.drag = { x: e.global.x - world.x, y: e.global.y - world.y };
    });
    stage.on('pointerup', () => (this.drag = undefined));
    stage.on('pointerupoutside', () => (this.drag = undefined));
    stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (this.drag) world.position.set(e.global.x - this.drag.x, e.global.y - this.drag.y);
    });
    app.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.mode !== 'game') return;
        e.preventDefault();
        const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, world.scale.x * Math.exp(-e.deltaY * 0.0015)));
        const k = scale / world.scale.x;
        gsap.to(world, { x: e.offsetX - (e.offsetX - world.x) * k, y: e.offsetY - (e.offsetY - world.y) * k, duration: 0.25, ease: 'power2.out' });
        gsap.to(world.scale, { x: scale, y: scale, duration: 0.25, ease: 'power2.out' });
      },
      { passive: false },
    );
    window.addEventListener('resize', () => this.mode === 'game' && this.fit(0));
  }

  setBounds(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.setMode(this.mode);
  }

  setMode(mode: 'menu' | 'game'): void {
    this.mode = mode;
    this.drift?.kill();
    if (mode === 'game') {
      this.fit(1.2);
      return;
    }
    const { width: sw, height: sh } = this.app.screen;
    const scale = Math.max(sw / this.width, sh / this.height) * 1.25;
    this.world.scale.set(scale);
    this.world.position.set(0, (sh - this.height * scale) / 2);
    this.drift = gsap.to(this.world, { x: sw - this.width * scale, duration: 60, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  /** Fits the map to the area left free by the HUD panels. */
  fit(duration: number): void {
    const { width: sw, height: sh } = this.app.screen;
    const pad = { left: 310, right: 400, top: 80, bottom: 175 };
    const aw = sw - pad.left - pad.right;
    const ah = sh - pad.top - pad.bottom;
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(aw / this.width, ah / this.height)));
    gsap.to(this.world.scale, { x: scale, y: scale, duration, ease: 'power3.inOut' });
    gsap.to(this.world, {
      x: pad.left + (aw - this.width * scale) / 2,
      y: pad.top + (ah - this.height * scale) / 2,
      duration,
      ease: 'power3.inOut',
    });
  }
}
