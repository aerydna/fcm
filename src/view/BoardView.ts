import { Application, Assets, BlurFilter, Container, type FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { DropShadowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { type GameMap, roadLinks, squareAt, TILE_SIZE } from '../engine/map';
import { seededRandom } from '../engine/rng';
import { GOOD_ICON } from '../ui/icons';
import { entranceSquares, hasDriveIn } from '../engine/geometry';
import type { Campaign, GameEvent, GameState, HouseState, Rect, Restaurant } from '../engine/types';
import { type AssetKey, loadAssets, makeGlowTexture } from './assets';
import { Camera } from './Camera';

export const CELL = 64;

const INK = 0x262626;
const PAPERS = [0xfbfaf6, 0xf8f7f2, 0xfaf8f1, 0xf7f6f1];
const ROAD = 0xc5d3e8;

export type TimeOfDay = 'day' | 'dusk' | 'night';

const SKY: Record<TimeOfDay, { tint: number; alpha: number; lights: number; clouds: number }> = {
  day: { tint: 0xffffff, alpha: 0, lights: 0, clouds: 1 },
  dusk: { tint: 0xff6a3d, alpha: 0.32, lights: 0.65, clouds: 0.5 },
  night: { tint: 0x0d1440, alpha: 0.62, lights: 1, clouds: 0 },
};

const CAR_COLORS = [0xb3322b, 0x1f5a4e, 0xf2c418, 0x8b2f5e, 0x4a6fa5, 0xeeeae0];

export { GOOD_ICON };
const CAMPAIGN_ICON = { billboard: '🪧', mailbox: '📫', radio: '📻', airplane: '✈️' };

export interface PlayerStyle {
  color: string;
  logo: string;
}

/** A clickable placement option; `rects[0]` top-left is the anchor square. */
export interface Target {
  id: number;
  rects: Rect[];
  marks?: (readonly [number, number])[];
}

const emoji = (text: string, size: number) =>
  new Text({ text, style: { fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif', fontSize: size }, resolution: 3, anchor: 0.5 });

const hash = (x: number, y: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

export class BoardView {
  private readonly world = new Container();
  private readonly ground = new Graphics();
  private readonly roads = new Graphics();
  private readonly cars = new Container();
  private readonly objects = new Container();
  private readonly clouds = new Container();
  private readonly overlay = new Graphics();
  private readonly lights = new Container();
  private readonly labels = new Container();
  private readonly dynamic = new Container();
  private readonly dynLights = new Container();
  private readonly fx = new Container();
  private readonly targetsG = new Graphics();
  private readonly previewG = new Graphics();
  private readonly glow: Texture;
  private readonly camera: Camera;
  private sky = { ...SKY.day };
  private readonly anims: gsap.core.Animation[] = [];
  private styles: { color: number; logo: Texture }[] = [];
  private anchors = new Map<string, Target[]>();
  private hover: string | null = null;
  private cycle = 0;
  private onPick: ((id: number) => void) | null = null;
  private previewColor = 0x2bb3a3;
  private pulse?: gsap.core.Tween;
  private houseSpots = new Map<number, { x: number; y: number }>();

  private constructor(
    app: Application,
    private readonly tex: Record<AssetKey, Texture>,
  ) {
    this.glow = makeGlowTexture();
    this.cars.filters = [new DropShadowFilter({ offset: { x: 2, y: 3 }, blur: 1, alpha: 0.4, color: 0x101010 })];
    this.dynamic.filters = [new DropShadowFilter({ offset: { x: 3, y: 4 }, blur: 1.5, alpha: 0.35, color: 0x101010 })];
    this.lights.blendMode = 'add';
    this.lights.addChild(this.dynLights);
    this.world.addChild(this.ground, this.roads, this.cars, this.objects, this.dynamic, this.clouds, this.overlay, this.lights, this.labels, this.targetsG, this.previewG, this.fx);
    app.stage.addChild(this.world);
    this.camera = new Camera(app, this.world);
    this.bindPointer(app);
  }

  static async create(host: HTMLElement): Promise<BoardView> {
    const app = new Application();
    await app.init({
      resizeTo: window,
      antialias: true,
      background: '#173634',
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });
    host.appendChild(app.canvas);
    return new BoardView(app, await loadAssets());
  }

  setMap(map: GameMap): void {
    this.anims.splice(0).forEach((a) => a.kill());
    for (const layer of [this.cars, this.objects, this.clouds, this.labels, this.dynamic, this.dynLights, this.fx]) {
      layer.removeChildren().forEach((c) => c.destroy());
    }
    this.lights.removeChildren().forEach((c) => c !== this.dynLights && c.destroy());
    this.lights.addChild(this.dynLights);
    this.setTargets(null);
    this.drawGround(map);
    this.drawRoads(map);
    this.drawHouses(map);
    this.drawDrinks(map);
    this.spawnCars(map, 9);
    this.spawnClouds(map);
    this.overlay.clear().rect(-20000, -20000, 40000 + map.width * CELL, 40000 + map.height * CELL).fill(0xffffff);
    this.camera.setBounds(map.width * CELL, map.height * CELL);
    this.applySky();
  }

  setTimeOfDay(tod: TimeOfDay, duration = 1.6): void {
    const target = SKY[tod];
    const from = { ...this.sky };
    const p = { t: 0 };
    gsap.to(p, {
      t: 1,
      duration,
      ease: 'sine.inOut',
      onUpdate: () => {
        this.sky = {
          tint: lerpColor(from.tint, target.tint, p.t),
          alpha: from.alpha + (target.alpha - from.alpha) * p.t,
          lights: from.lights + (target.lights - from.lights) * p.t,
          clouds: from.clouds + (target.clouds - from.clouds) * p.t,
        };
        this.applySky();
      },
    });
  }

  /** Menu: slow cinematic drift. Game: free pan/zoom. */
  setMode(mode: 'menu' | 'game'): void {
    this.camera.setMode(mode);
  }

  async setPlayers(styles: PlayerStyle[]): Promise<void> {
    const logos = await Promise.all(styles.map((s) => Assets.load<Texture>(s.logo)));
    this.styles = styles.map((s, i) => ({ color: parseInt(s.color.slice(1), 16), logo: logos[i] }));
  }

  /** Redraws everything that changes during play. */
  sync(state: GameState): void {
    this.dynamic.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.dynLights.removeChildren().forEach((c) => c.destroy());
    const bodies = new Container();
    const top = new Container();
    this.dynamic.addChild(bodies, top);
    for (const h of state.houses) {
      if (h.garden) this.drawGarden(h.garden, bodies);
      if (!h.printed) {
        this.houseSpots.set(h.number, { x: h.x, y: h.y });
        this.drawHouse(h.number, h.x, h.y, bodies, this.dynLights, top);
      }
    }
    for (const c of state.campaigns) this.drawCampaign(state, c, bodies, top);
    for (const r of state.restaurants) this.drawRestaurant(r, hasDriveIn(state, r.owner), bodies);
    for (const h of state.houses) this.drawDemand(h, top);
  }

  private drawGarden(g: Rect, layer: Container): void {
    const gr = new Graphics().rect(g.x * CELL, g.y * CELL, g.w * CELL, g.h * CELL).fill(0x86b85a).stroke({ color: INK, width: 2 });
    for (let k = 0; k < g.w * g.h * 3; k++) {
      gr.circle(g.x * CELL + 10 + hash(g.x + k, g.y) * (g.w * CELL - 20), g.y * CELL + 10 + hash(g.y + k, g.x) * (g.h * CELL - 20), 7).fill(0x5f9440);
    }
    layer.addChild(gr);
  }

  private drawRestaurant(r: Restaurant, driveIn: boolean, layer: Container): void {
    const style = this.styles[r.owner];
    const c = new Container();
    c.position.set(r.x * CELL, r.y * CELL);
    c.addChild(
      new Graphics()
        .roundRect(5, 5, CELL * 2 - 10, CELL * 2 - 10, 12)
        .fill(style?.color ?? 0x888888)
        .stroke({ color: INK, width: 3 })
        .roundRect(12, 12, CELL * 2 - 24, CELL * 2 - 24, 8)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.8 }),
    );
    if (style) {
      const logo = new Sprite({ texture: style.logo, anchor: 0.5 });
      logo.position.set(CELL, CELL);
      logo.setSize(CELL * 1.15, CELL * 1.15);
      c.addChild(logo);
    }
    for (const [ex, ey] of entranceSquares(r, driveIn)) {
      const lx = (ex - r.x) * CELL + (ex === r.x ? 10 : CELL - 10);
      const ly = (ey - r.y) * CELL + (ey === r.y ? 10 : CELL - 10);
      c.addChild(new Graphics().circle(lx, ly, 9).fill(0xffffff).stroke({ color: INK, width: 2.5 }).circle(lx, ly, 3.5).fill(INK));
    }
    if (r.comingSoon) {
      c.alpha = 0.7;
      const soon = new Text({ text: 'COMING SOON', style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 15, fill: 0xffffff, stroke: { color: INK, width: 4 } }, resolution: 3, anchor: 0.5 });
      soon.position.set(CELL, CELL * 1.62);
      c.addChild(soon);
    }
    layer.addChild(c);
    const neon = new Sprite({ texture: this.glow, anchor: 0.5, tint: style?.color ?? 0xffffff, alpha: 0.8 });
    neon.position.set(r.x * CELL + CELL, r.y * CELL + CELL);
    neon.scale.set(3);
    this.dynLights.addChild(neon);
  }

  private drawCampaign(state: GameState, c: Campaign, layer: Container, top: Container): void {
    const color = this.styles[c.owner]?.color ?? 0x888888;
    const g = new Graphics();
    let cx: number;
    let cy: number;
    if (c.band) {
      const { axis, start, size } = c.band;
      const W = state.map.width * CELL;
      const H = state.map.height * CELL;
      const r = axis === 'row' ? { x: 0, y: start * CELL, w: W, h: size * CELL } : { x: start * CELL, y: 0, w: size * CELL, h: H };
      g.rect(r.x, r.y, r.w, r.h).fill({ color, alpha: 0.12 }).stroke({ color, width: 3, alpha: 0.7 });
      cx = axis === 'row' ? -CELL * 0.6 : r.x + r.w / 2;
      cy = axis === 'row' ? r.y + r.h / 2 : -CELL * 0.6;
      top.addChild(g);
    } else {
      const r = c.rect!;
      g.roundRect(r.x * CELL + 4, r.y * CELL + 4, r.w * CELL - 8, r.h * CELL - 8, 8)
        .fill(0x2a2723)
        .stroke({ color, width: 5 });
      cx = (r.x + r.w / 2) * CELL;
      cy = (r.y + r.h / 2) * CELL;
      layer.addChild(g);
    }
    const icon = emoji(CAMPAIGN_ICON[c.type], 26);
    icon.position.set(cx - 14, cy);
    const good = emoji(GOOD_ICON[c.good], 22);
    good.position.set(cx + 16, cy);
    const info = new Text({
      text: `#${c.number}  ${c.eternal ? '\u221e' : `\u00d7${c.remaining}`}`,
      style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 12, fill: 0xffffff, stroke: { color: INK, width: 3 } },
      resolution: 3,
      anchor: 0.5,
    });
    info.position.set(cx, cy + 22);
    top.addChild(icon, good, info);
  }

  private drawDemand(h: HouseState, layer: Container): void {
    h.demand.forEach((good, i) => {
      const x = h.x * CELL + 16 + i * 22;
      const y = h.y * CELL + CELL * 2 - 14;
      layer.addChild(new Graphics().circle(x, y, 11).fill(0xffffff).stroke({ color: INK, width: 2 }));
      const icon = emoji(GOOD_ICON[good], 14);
      icon.position.set(x, y);
      layer.addChild(icon);
    });
  }

  /** Floating feedback for Dinnertime income and new demand. */
  animateEvents(events: readonly GameEvent[]): void {
    let delay = 0;
    for (const e of events) {
      if (e.type !== 'served' && e.type !== 'demand') continue;
      const spot = this.houseSpots.get(e.house);
      if (!spot) continue;
      const text =
        e.type === 'served'
          ? new Text({ text: `+$${e.income}`, style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 30, fill: this.styles[e.player]?.color ?? 0xffffff, stroke: { color: 0xffffff, width: 6 } }, resolution: 2, anchor: 0.5 })
          : emoji(GOOD_ICON[e.good], 30);
      text.position.set(spot.x * CELL + CELL, spot.y * CELL + CELL);
      text.alpha = 0;
      this.fx.addChild(text);
      gsap
        .timeline({ delay, onComplete: () => text.destroy() })
        .to(text, { alpha: 1, duration: 0.2 })
        .to(text, { y: text.y - 60, duration: 1.4, ease: 'power2.out' }, 0)
        .to(text, { alpha: 0, duration: 0.4 }, 1.1);
      delay += e.type === 'served' ? 0.35 : 0.12;
    }
  }

  /** Shows placement options; hover previews, R / right-click cycles options on the same anchor, click picks. */
  setTargets(targets: Target[] | null, onPick?: (id: number) => void, color?: string): void {
    this.anchors.clear();
    this.onPick = targets ? (onPick ?? null) : null;
    if (color) this.previewColor = parseInt(color.slice(1), 16);
    for (const t of targets ?? []) {
      const key = `${t.rects[0].x},${t.rects[0].y}`;
      const list = this.anchors.get(key);
      if (list) list.push(t);
      else this.anchors.set(key, [t]);
    }
    const g = this.targetsG.clear();
    for (const key of this.anchors.keys()) {
      const [x, y] = key.split(',').map(Number);
      g.roundRect(x * CELL + 6, y * CELL + 6, CELL - 12, CELL - 12, 10).fill({ color: this.previewColor, alpha: 0.28 }).stroke({ color: this.previewColor, width: 2, alpha: 0.9 });
    }
    if (this.anchors.size) {
      this.pulse?.kill();
      this.pulse = gsap.fromTo(g, { alpha: 0.55 }, { alpha: 1, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    this.drawPreview();
  }

  private current(): Target | undefined {
    const list = this.hover ? this.anchors.get(this.hover) : undefined;
    return list?.[this.cycle % list.length];
  }

  private drawPreview(): void {
    const g = this.previewG.clear();
    const t = this.current();
    if (!t) return;
    for (const r of t.rects) {
      g.roundRect(r.x * CELL + 3, r.y * CELL + 3, r.w * CELL - 6, r.h * CELL - 6, 10).fill({ color: this.previewColor, alpha: 0.45 }).stroke({ color: INK, width: 3 });
    }
    for (const [x, y] of t.marks ?? []) g.circle(x * CELL + CELL / 2, y * CELL + CELL / 2, 12).fill(0xffffff).stroke({ color: INK, width: 3 });
  }

  private bindPointer(app: Application): void {
    let down: { x: number; y: number } | null = null;
    const square = (e: FederatedPointerEvent) => {
      const p = this.world.toLocal(e.global);
      return `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
    };
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => (down = { x: e.global.x, y: e.global.y }));
    app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      const key = square(e);
      if (key === this.hover) return;
      this.hover = key;
      this.cycle = 0;
      this.drawPreview();
    });
    app.stage.on('pointerup', (e: FederatedPointerEvent) => {
      const moved = down ? Math.hypot(e.global.x - down.x, e.global.y - down.y) : 99;
      down = null;
      if (e.button === 2) {
        this.cycle++;
        this.drawPreview();
        return;
      }
      const t = this.current();
      if (moved < 6 && t && this.onPick) this.onPick(t.id);
    });
    app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.cycle++;
        this.drawPreview();
      }
    });
  }

  private applySky(): void {
    this.overlay.tint = this.sky.tint;
    this.overlay.alpha = this.sky.alpha;
    this.lights.alpha = this.sky.lights;
    this.clouds.alpha = this.sky.clouds;
  }

  private drawGround(map: GameMap): void {
    const g = this.ground.clear();
    const W = map.width * CELL;
    const H = map.height * CELL;
    const T = TILE_SIZE * CELL;
    g.roundRect(-14, -8, W + 28, H + 30, 10).fill({ color: 0x000000, alpha: 0.35 });
    g.roundRect(-10, -10, W + 20, H + 20, 8).fill(0x2a2723);

    for (const t of map.tiles) {
      const X = t.col * T;
      const Y = t.row * T;
      g.rect(X, Y, T, T).fill(PAPERS[(t.col * 7 + t.row * 3) % PAPERS.length]);
      // Cardboard grain.
      for (let k = 0; k < 140; k++) {
        g.rect(X + hash(t.col + k, t.row - k) * T, Y + hash(t.row + k * 1.7, t.col) * T, 1.5, 1.5).fill({ color: 0x8a7f6a, alpha: 0.12 });
      }
    }
    for (let i = 0; i <= map.width; i++) g.moveTo(i * CELL, 0).lineTo(i * CELL, H);
    for (let j = 0; j <= map.height; j++) g.moveTo(0, j * CELL).lineTo(W, j * CELL);
    g.stroke({ color: INK, width: 1.2, alpha: 0.7 });
    for (const t of map.tiles) {
      g.rect(t.col * T + 1, t.row * T + 1, T - 2, T - 2).stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
      g.rect(t.col * T, t.row * T, T, T).stroke({ color: 0x1a1a1a, width: 2.5 });
    }
  }

  private drawRoads(map: GameMap): void {
    const g = this.roads.clear();
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (squareAt(map, x, y)?.kind !== 'road') continue;
        g.rect(x * CELL - 0.6, y * CELL - 0.6, CELL + 1.2, CELL + 1.2).fill(ROAD);
      }
    }
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (squareAt(map, x, y)?.kind !== 'road') continue;
        const links = roadLinks(map, x, y);
        const has = (dx: number, dy: number) => links.some(([lx, ly]) => lx === x + dx && ly === y + dy);
        const n = has(0, -1), e = has(1, 0), s = has(0, 1), w = has(-1, 0);
        const X = x * CELL, Y = y * CELL;

        if (!n) g.moveTo(X, Y).lineTo(X + CELL, Y);
        if (!s) g.moveTo(X, Y + CELL).lineTo(X + CELL, Y + CELL);
        if (!w) g.moveTo(X, Y).lineTo(X, Y + CELL);
        if (!e) g.moveTo(X + CELL, Y).lineTo(X + CELL, Y + CELL);
        g.stroke({ color: INK, width: 2, cap: 'square' });

        // Dash phase is anchored to the square edge so dashes line up across squares.
        const c = CELL / 2;
        for (const [on, dx, dy] of [[n, 0, -1], [e, 1, 0], [s, 0, 1], [w, -1, 0]] as const) {
          if (!on) continue;
          for (let d = c - 3; d > 2; d -= 13) {
            g.moveTo(X + c + dx * d, Y + c + dy * d).lineTo(X + c + dx * Math.max(d - 7, 0), Y + c + dy * Math.max(d - 7, 0));
          }
        }
        g.stroke({ color: INK, width: 2 });
        if (links.length >= 3) this.addLamp(X + c, Y + c);
      }
    }
  }

  private addLamp(x: number, y: number): void {
    const light = new Sprite({ texture: this.glow, anchor: 0.5, tint: 0xffc56b, alpha: 0.5 });
    light.position.set(x, y);
    light.scale.set(1.8);
    this.lights.addChild(light);
  }

  private drawHouses(map: GameMap): void {
    this.houseSpots.clear();
    for (const h of map.houses) {
      this.houseSpots.set(h.number, { x: h.x, y: h.y });
      this.drawHouse(h.number, h.x, h.y, this.objects, this.lights, this.labels);
    }
  }

  private drawHouse(number: number, hx: number, hy: number, body: Container, lights: Container, labels: Container): void {
    const house = new Sprite(this.tex.house);
    house.position.set(hx * CELL, hy * CELL);
    house.setSize(CELL * 2, CELL * 2);
    const frame = new Graphics().rect(hx * CELL, hy * CELL, CELL * 2, CELL * 2).stroke({ color: INK, width: 2 });
    body.addChild(house, frame);

    const windows = new Sprite(this.tex.houseLights);
    windows.position.copyFrom(house.position);
    windows.setSize(CELL * 2, CELL * 2);
    const halo = new Sprite({ texture: this.glow, anchor: 0.5, tint: 0xffa94d, alpha: 0.5 });
    halo.position.set(hx * CELL + CELL * 1.1, hy * CELL + CELL * 1.45);
    halo.scale.set(1.8, 0.9);
    lights.addChild(halo, windows);

    const label = new Text({
      text: String(number),
      style: { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 30, fill: 0xffffff },
      resolution: 3,
    });
    label.anchor.set(1, 0);
    label.position.set(hx * CELL + CELL * 2 - 9, hy * CELL + 5);
    labels.addChild(label);
  }

  private drawDrinks(map: GameMap): void {
    map.squares.forEach((sq, i) => {
      if (sq.kind !== 'drink') return;
      const x = (i % map.width) * CELL + CELL / 2;
      const y = Math.floor(i / map.width) * CELL + CELL / 2;
      const icon = new Sprite({ texture: this.tex[`drink-${sq.drink}`], anchor: 0.5 });
      icon.position.set(x, y);
      icon.setSize(CELL, CELL);
      const frame = new Graphics().rect(x - CELL / 2, y - CELL / 2, CELL, CELL).stroke({ color: INK, width: 2 });
      this.objects.addChild(icon, frame);
      const neon = new Sprite({ texture: this.glow, anchor: 0.5, tint: { softdrink: 0xff4d6d, beer: 0x4dffb0, lemonade: 0xffe14d }[sq.drink], alpha: 0.7 });
      neon.position.set(x, y);
      neon.scale.set(1.1);
      this.lights.addChild(neon);
    });
  }

  private spawnCars(map: GameMap, count: number): void {
    const roads: [number, number][] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (roadLinks(map, x, y).length) roads.push([x, y]);
    const rnd = seededRandom(map.tiles.length * 997 + roads.length);
    for (let i = 0; i < count && roads.length; i++) {
      const [sx, sy] = roads[Math.floor(rnd() * roads.length)];
      const car = new Container();
      const body = new Graphics()
        .roundRect(-13, -8, 26, 16, 6).fill(CAR_COLORS[i % CAR_COLORS.length]).stroke({ color: 0x2b2d42, width: 2 })
        .roundRect(-4, -6, 11, 12, 3).fill(0xfffaf0).stroke({ color: 0x2b2d42, width: 1.5 })
        .rect(5, -5, 3, 10).fill(0x9ad4ea);
      car.addChild(body);
      const beam = new Sprite({ texture: this.glow, anchor: { x: 0.15, y: 0.5 }, tint: 0xfff1c1, alpha: 0.8 });
      beam.scale.set(0.9, 0.45);
      this.lights.addChild(beam);
      this.cars.addChild(car);
      this.driveCar(map, car, beam, sx, sy, -1, -1, rnd);
    }
  }

  private driveCar(map: GameMap, car: Container, beam: Sprite, x: number, y: number, px: number, py: number, rnd: () => number): void {
    const links = roadLinks(map, x, y);
    const options = links.filter(([lx, ly]) => lx !== px || ly !== py);
    const [nx, ny] = (options.length ? options : links)[Math.floor(rnd() * (options.length || links.length))];
    const angle = Math.atan2(ny - y, nx - x);
    const lane = 9;
    const pos = (cx: number, cy: number) => ({
      x: cx * CELL + CELL / 2 - Math.sin(angle) * lane,
      y: cy * CELL + CELL / 2 + Math.cos(angle) * lane,
    });
    if (px < 0) {
      car.position.copyFrom(pos(x, y));
      car.rotation = angle;
    }
    let delta = angle - car.rotation;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const tl = gsap.timeline({ onComplete: () => this.driveCar(map, car, beam, nx, ny, x, y, rnd) });
    tl.to(car, { rotation: car.rotation + delta, duration: Math.abs(delta) > 0.1 ? 0.25 : 0, ease: 'sine.out' }, 0);
    tl.to(car, { ...pos(nx, ny), duration: 0.7 + rnd() * 0.3, ease: 'none' }, 0);
    tl.eventCallback('onUpdate', () => {
      beam.position.set(car.x + Math.cos(car.rotation) * 12, car.y + Math.sin(car.rotation) * 12);
      beam.rotation = car.rotation;
    });
    this.anims.push(tl);
  }

  private spawnClouds(map: GameMap): void {
    const W = map.width * CELL;
    const H = map.height * CELL;
    for (let i = 0; i < 6; i++) {
      const cloud = new Graphics();
      for (let k = 0; k < 4; k++) cloud.ellipse(k * 70 - 100, Math.sin(k * 2) * 30, 110, 60).fill(0x0b2b1a);
      cloud.alpha = 0.1;
      cloud.filters = [new BlurFilter({ strength: 40, quality: 3 })];
      cloud.position.set(-400 + hash(i, 1) * W, hash(i, 2) * H);
      this.clouds.addChild(cloud);
      this.anims.push(
        gsap.fromTo(cloud, { x: -500 }, { x: W + 500, duration: 70 + hash(i, 3) * 60, repeat: -1, ease: 'none' }).progress(hash(i, 4)),
      );
    }
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const mix = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return mix(16) | mix(8) | mix(0);
}
