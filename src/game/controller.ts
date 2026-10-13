import { chooseEasy } from '../ai/easy';
import { EMPLOYEES, GOODS, type Good } from '../engine/data';
import { actionYield, apply, IllegalAction, newGame, visibleState } from '../engine/game';
import type { Action, GameEvent, GameState, Goods, PlayerId } from '../engine/types';
import type { Difficulty } from '../ui/chains';
import { actionLabel, eventLabel } from '../ui/labels';
import { GOOD_ICON as GOOD_TEXT } from '../ui/icons';
import { type Spotlight, spotlightFor } from './spotlight';

export interface LogEntry {
  round: number;
  player: PlayerId | null;
  text: string;
  important?: boolean;
}

/** What each player did in the current round. */
export interface TurnStats {
  cashStart: number;
  produced: Partial<Goods>;
  hired: string[];
  trained: [string, string][];
  /** Notable actions this round, in order (chips for the summary). */
  did: { icon: string; chip: string; title: string }[];
}

export interface DinnerReport {
  round: number;
  served: { house: number; player: PlayerId; goods: Good[]; income: number }[];
  unserved: { house: number; goods: Good[] }[];
  dinner: number[];
  waitresses: number[];
  cfo: number[];
  salaries: (number | null)[];
  bankBroken: number;
}

export interface Note {
  kind: 'milestone' | 'production' | 'bank' | 'staff' | 'rival';
  player: PlayerId;
  title: string;
  detail?: string;
  spot?: Spotlight;
}

export interface Snapshot {
  /** State as visible to the human player. */
  view: GameState;
  log: LogEntry[];
  thinking: PlayerId | null;
  stats: TurnStats[];
  report: DinnerReport | null;
}

type Listener = (events: GameEvent[], snapshot: Snapshot, notes: Note[]) => void;

const CPU_DELAY = 260;
/** Pause after a notable CPU action so the player can read the highlight. */
const CPU_SHOW = 1800;

export class GameController {
  private state: GameState;
  private snapshot: Snapshot;
  private readonly listeners = new Set<Listener>();
  private running = false;
  private disposed = false;
  private holdUntil = 0;
  private paused = 0;
  private lastNotable = false;
  /** CPU speed multiplier (1, 2, 4). */
  speed = 1;

  constructor(
    seed: number,
    chains: string[],
    readonly difficulty: Difficulty,
    readonly human: PlayerId = 0,
  ) {
    this.state = newGame({ seed, chains });
    this.snapshot = { view: visibleState(this.state, human), log: [], thinking: null, stats: this.freshStats(), report: null };
  }

  private freshStats(): TurnStats[] {
    return this.state.players.map((p) => ({ cashStart: p.cash, produced: {}, hired: [], trained: [], did: [] }));
  }

  get current(): Snapshot {
    return this.snapshot;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Applies a human action; returns an error message if illegal. */
  act(action: Action): string | null {
    if (this.state.active !== this.human) return 'Not your turn';
    try {
      this.commit(this.human, action);
    } catch (e) {
      if (e instanceof IllegalAction) return e.message;
      throw e;
    }
    void this.runCpus();
    return null;
  }

  start(): void {
    void this.runCpus();
  }

  /** Delays CPU moves so the player can follow an animation. */
  hold(ms: number): void {
    this.holdUntil = Math.max(this.holdUntil, Date.now() + ms);
  }

  /** Stops CPU moves until a matching resume() (e.g. while a splash waits for Continue). */
  pause(): void {
    this.paused++;
  }

  resume(): void {
    this.paused = Math.max(0, this.paused - 1);
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private commit(player: PlayerId, action: Action): void {
    const before = this.state;
    const { state, events } = apply(before, player, action);
    this.state = state;
    const entries: LogEntry[] = [];
    const notes: Note[] = [];
    let stats = this.snapshot.stats.map((s) => ({ ...s, produced: { ...s.produced }, hired: [...s.hired], trained: [...s.trained], did: [...s.did] }));
    let report = this.snapshot.report;

    const spot = spotlightFor(before, state, player, action);
    this.lastNotable = !!spot && player !== this.human;
    if (spot) {
      stats[player].did.push({ icon: spot.icon, chip: spot.chip, title: spot.title });
      if (player !== this.human) notes.push({ kind: 'rival', player, title: spot.title, detail: spot.detail, spot });
    }

    if (action.type !== 'endStep' && action.type !== 'chooseReserve') entries.push({ round: before.round, player, text: actionLabel(before, player, action) });
    if (action.type === 'produce' || action.type === 'buyDrinks') {
      const got = actionYield(before, player, action);
      const gained = GOODS.filter((g) => got[g]);
      for (const g of gained) stats[player].produced[g] = (stats[player].produced[g] ?? 0) + got[g]!;
      notes.push({ kind: 'production', player, title: gained.map((g) => `${GOOD_TEXT[g]} \u00d7${got[g]}`).join('  ') || 'nothing collected' });
    }
    if (action.type === 'recruit') {
      stats[player].hired.push(action.employee);
      notes.push({ kind: 'staff', player, title: `Hired ${EMPLOYEES[action.employee].name}`, detail: 'On the beach: can work from next turn.' });
    }
    if (action.type === 'train') {
      const from = before.players[player].cards.find((c) => c.uid === action.card)!.type;
      stats[player].trained.push([from, action.to]);
      notes.push({ kind: 'staff', player, title: `${EMPLOYEES[from].name} → ${EMPLOYEES[action.to].name}`, detail: 'Trained (stays on the beach this turn).' });
    }

    for (const e of events) {
      const text = eventLabel(state, e);
      if (text) entries.push({ round: state.round, player: null, text, important: e.type !== 'salaries' && e.type !== 'income' });
      if (e.type === 'phase' && e.phase === 'dinnertime') {
        const zeros = () => state.players.map(() => 0);
        report = { round: before.round, served: [], unserved: [], dinner: zeros(), waitresses: zeros(), cfo: zeros(), salaries: state.players.map(() => null), bankBroken: 0 };
      }
      if (e.type === 'phase' && e.phase === 'restructuring') stats = state.players.map((p) => ({ cashStart: p.cash, produced: {}, hired: [], trained: [], did: [] }));
      if (!report) continue;
      if (e.type === 'served') report.served.push({ house: e.house, player: e.player, goods: e.goods, income: e.income });
      if (e.type === 'income' && e.reason === 'dinner') report.dinner[e.player] += e.amount;
      if (e.type === 'income' && e.reason === 'waitresses') report.waitresses[e.player] += e.amount;
      if (e.type === 'income' && e.reason === 'cfo') report.cfo[e.player] += e.amount;
      if (e.type === 'salaries' && report.round === before.round) report.salaries[e.player] = e.amount;
      if (e.type === 'bankBroken') {
        report.bankBroken = e.times;
        notes.push({ kind: 'bank', player, title: e.times === 1 ? 'The bank is broken!' : 'The bank broke again!', detail: e.times === 1 ? `Reserve cards revealed: +$${e.added}. CEO slots change next turn.` : 'Last Dinnertime: the game ends now.' });
      }
      if (e.type === 'milestone') notes.push({ kind: 'milestone', player: e.player, title: e.milestone });
    }
    if (report && events.some((e) => e.type === 'phase' && e.phase === 'dinnertime')) {
      const served = new Set(report.served.map((s) => s.house));
      report.unserved = before.houses.filter((h) => h.demand.length && !served.has(h.number)).map((h) => ({ house: h.number, goods: h.demand }));
    }
    this.publish(events, [...this.snapshot.log, ...entries].slice(-200), stats, report ? { ...report } : null, notes);
  }

  private publish(events: GameEvent[], log = this.snapshot.log, stats = this.snapshot.stats, report = this.snapshot.report, notes: Note[] = []): void {
    const cpuTurn = this.state.active !== null && this.state.active !== this.human;
    this.snapshot = { view: visibleState(this.state, this.human), log, thinking: cpuTurn ? this.state.active : null, stats, report };
    for (const fn of this.listeners) fn(events, this.snapshot, notes);
  }

  private async runCpus(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.publish([]);
    while (!this.disposed && this.state.active !== null && this.state.active !== this.human) {
      await new Promise((r) => setTimeout(r, (this.lastNotable ? CPU_SHOW : CPU_DELAY) / this.speed));
      while (!this.disposed && Date.now() < this.holdUntil) await new Promise((r) => setTimeout(r, this.holdUntil - Date.now()));
      while (!this.disposed && this.paused > 0) await new Promise((r) => setTimeout(r, 100));
      if (this.disposed) break;
      const me = this.state.active;
      this.commit(me, chooseEasy(visibleState(this.state, me), me));
    }
    this.running = false;
    if (!this.disposed) this.publish([]);
  }
}
