import { useCallback, useEffect, useRef, useState } from 'react';
import { GameController, type Note, type Snapshot } from '../game/controller';
import type { GameEvent, PlayerId } from '../engine/types';
import type { BoardView } from '../view/BoardView';
import { ActionPanel } from './ActionPanel';
import { describeSquare } from './boardInfo';
import { CHAINS, type Difficulty } from './chains';
import { GameHud, LogPanel } from './GameHud';
import { MainMenu, type NewGame } from './MainMenu';
import { CompanyReveal, TurnRecapCard } from './Moments';
import { DinnerReportModal, MilestoneBoard, PlayerDrawer, type RivalItem, RivalFeed, StaffModal, type Toast, Toasts } from './Overlays';
import { buildSequence, PhaseSplash, type SequenceStep, type Splash } from './PhaseSplash';
import { showBoardTip, TooltipLayer } from './Tooltip';

let toastSeq = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Moment = Extract<SequenceStep, { kind: 'reveal' | 'recap' }>;

export function App({ board }: { board: BoardView }) {
  const ctrl = useRef<GameController | null>(null);
  const [snap, setSnap] = useState<Snapshot>();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [drawer, setDrawer] = useState<PlayerId | null>(null);
  const [milestones, setMilestones] = useState(false);
  const [staff, setStaff] = useState(false);
  const [reportSeen, setReportSeen] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rivals, setRivals] = useState<RivalItem[]>([]);
  const [speed, setSpeed] = useState(1);
  const [splash, setSplash] = useState<Splash | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [undos, setUndos] = useState(0);
  const [sequencing, setSequencing] = useState(false);
  const latest = useRef<Snapshot | undefined>(undefined);
  const busy = useRef(false);
  const chain = useRef(Promise.resolve());
  const splashDone = useRef<(() => void) | null>(null);

  useEffect(() => () => ctrl.current?.dispose(), []);

  useEffect(() => {
    let last = '';
    board.onHover = (sq) => {
      const key = sq ? `${sq.x},${sq.y}` : '';
      if (key === last) return;
      last = key;
      const view = latest.current?.view;
      const text = sq && view ? describeSquare(view, sq.x, sq.y) : null;
      showBoardTip(text, sq?.sx, sq?.sy);
    };
    return () => {
      board.onHover = null;
    };
  }, [board]);

  const showSplash = (s: Splash) =>
    new Promise<void>((resolve) => {
      splashDone.current = resolve;
      setSplash(s);
    });
  const endSplash = useCallback(() => {
    setSplash(null);
    setMoment(null);
    splashDone.current?.();
    splashDone.current = null;
  }, []);
  const showMoment = (m: Moment) =>
    new Promise<void>((resolve) => {
      splashDone.current = resolve;
      setMoment(m);
    });

  /** Plays the batch's splash screens and animations in order, CPUs paused; the board is synced at the end. */
  const playBatch = (steps: SequenceStep[], events: GameEvent[], c: GameController) => {
    c.pause();
    chain.current = chain.current.then(async () => {
      busy.current = true;
      setSequencing(true);
      for (const step of steps) {
        if (ctrl.current !== c) break;
        if (step.kind === 'splash') {
          if (step.phase === 'restructuring') board.setTimeOfDay('day', 1.2);
          if (step.phase === 'dinnertime') board.setTimeOfDay('dusk', 1);
          if (step.phase === 'marketing-campaigns' || step.phase === 'clean-up') board.setTimeOfDay('night', 0.8);
          await showSplash(step.splash);
        }
        if (step.kind === 'dinner') await sleep(board.animateDinner(events) + 200);
        if (step.kind === 'recap') {
          setRivals([]);
          const color = CHAINS.find((ch) => ch.id === latest.current?.view.players[step.recap.player].chain)?.color;
          for (const it of step.recap.items) if (it.rect && color) board.flashRect(it.rect, color, it.chip);
          await showMoment(step);
        }
        if (step.kind === 'reveal') await showMoment(step);
        if (step.kind === 'demand' && latest.current) {
          board.sync(latest.current.view);
          board.animateEvents(events);
          await sleep(2800);
        }
      }
      busy.current = false;
      setSequencing(false);
      if (latest.current) board.sync(latest.current.view);
      c.resume();
    });
  };

  const pushNotes = useCallback((notes: Note[], human: PlayerId) => {
    for (const n of notes.filter((x) => x.kind === 'rival' && x.spot)) {
      const item = { id: ++toastSeq, player: n.player, spot: n.spot! };
      setRivals((r) => [...r, item].slice(-3));
      setTimeout(() => setRivals((r) => r.filter((x) => x.id !== item.id)), 5000);
      const color = CHAINS.find((ch) => ch.id === latest.current?.view.players[n.player].chain)?.color;
      if (n.spot!.rect && color) board.flashRect(n.spot!.rect, color, 'NEW');
    }
    // Rival milestones are shown in their turn recap or in the structure reveal.
    const shown = notes.filter((n) => n.kind === 'bank' || (n.kind !== 'rival' && n.kind !== 'turn' && n.player === human));
    if (!shown.length) return;
    const added = shown.map((n) => ({ ...n, id: ++toastSeq }));
    setToasts((t) => [...t, ...added].slice(-4));
    for (const a of added) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), a.kind === 'production' || a.kind === 'staff' ? 4500 : 8000);
  }, []);

  const start = async ({ chain, difficulty }: NewGame) => {
    const rivals = CHAINS.filter((c) => c.id !== chain)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const chains = [chain, ...rivals.map((c) => c.id)];
    const c = new GameController(Date.now() >>> 0, chains, difficulty);
    await board.setPlayers(chains.map((id) => CHAINS.find((x) => x.id === id)!));
    board.setMap(c.current.view.map);
    board.sync(c.current.view);
    board.setMode('game');
    board.setTimeOfDay('day', 0.8);

    c.subscribe((events, s, notes) => {
      const before = latest.current?.view;
      latest.current = s;
      pushNotes(notes, c.human);
      const recaps: SequenceStep[] = notes.filter((n) => n.kind === 'turn' && n.recap).map((n) => ({ kind: 'recap', recap: n.recap! }));
      const steps = [...recaps, ...buildSequence(events, before, s.view, c.human)];
      if (steps.length) playBatch(steps, events, c);
      else if (!busy.current) {
        board.sync(s.view);
        board.animateEvents(events);
      }
      setSnap(s);
    });
    latest.current = c.current;
    ctrl.current = c;
    c.speed = speed;
    setDifficulty(difficulty);
    setReportSeen(0);
    setToasts([]);
    setRivals([]);
    setSnap(c.current);
    c.start();
  };

  const quit = () => {
    ctrl.current?.dispose();
    ctrl.current = null;
    latest.current = undefined;
    endSplash();
    setSnap(undefined);
    setDrawer(null);
    setMilestones(false);
    board.setTargets(null);
    board.setMode('menu');
    board.setTimeOfDay('dusk');
  };

  const c = ctrl.current;
  const report =
    snap?.report && !sequencing && snap.report.round > reportSeen && (snap.report.served.length > 0 || snap.report.waitresses.some((x) => x > 0) || snap.report.bankBroken > 0)
      ? snap.report
      : null;
  const reportOpen = report ? report.round : 0;
  // The CPUs wait while the dinner report is open, so it is not interrupted by their turns.
  useEffect(() => {
    if (!reportOpen || !c) return;
    c.pause();
    return () => c.resume();
  }, [reportOpen, c]);
  const canUndo = !!snap?.undo && !sequencing && !moment && !splash && !report;
  const undo = () => {
    if (!canUndo || !c?.undo()) return;
    setUndos((n) => n + 1);
    setRivals([]);
    setToasts([]);
    board.setTargets(null);
  };
  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoRef.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className={`ui ${snap ? 'in-game' : 'in-menu'}`}>
      {snap && c ? (
        <>
          <GameHud
            view={snap.view}
            me={c.human}
            difficulty={difficulty}
            stats={snap.stats}
            onQuit={quit}
            onOpenPlayer={setDrawer}
            onOpenMilestones={() => setMilestones(true)}
            onOpenStaff={() => setStaff(true)}
            speed={speed}
            onSpeed={() => {
              const next = speed === 4 ? 1 : speed * 2;
              setSpeed(next);
              c.speed = next;
            }}
          />
          <aside className={`side ${moment ? 'blocked' : ''}`}>
            {snap.undo && (
              <button className="undo" onClick={undo} disabled={!canUndo} data-tip={`Take back: ${snap.undo} (Ctrl+Z).\nWhat the CPUs did after it is taken back too. Not possible past a structure reveal.`}>
                ↶ Undo <small>{snap.undo}</small>
              </button>
            )}
            <ActionPanel key={undos} view={snap.view} me={c.human} board={board} stats={snap.stats[c.human]} paused={sequencing} act={(a) => c.act(a)} />
            <LogPanel view={snap.view} log={snap.log} />
          </aside>
          <Toasts view={snap.view} toasts={toasts} me={c.human} />
          <RivalFeed view={snap.view} items={rivals} />
          {drawer !== null && <PlayerDrawer view={snap.view} id={drawer} me={c.human} stats={snap.stats[drawer]} onClose={() => setDrawer(null)} />}
          {milestones && <MilestoneBoard view={snap.view} onClose={() => setMilestones(false)} />}
          {staff && <StaffModal view={snap.view} onClose={() => setStaff(false)} />}
          {report && drawer === null && !milestones && !staff && <DinnerReportModal view={snap.view} report={report} me={c.human} onClose={() => setReportSeen(report.round)} />}
        </>
      ) : (
        <MainMenu onStart={start} />
      )}
      {splash && <PhaseSplash splash={splash} onDone={endSplash} />}
      {snap && c && moment?.kind === 'recap' && <TurnRecapCard view={snap.view} recap={moment.recap} onDone={endSplash} />}
      {snap && c && moment?.kind === 'reveal' && <CompanyReveal view={snap.view} me={c.human} milestones={moment.milestones} onDone={endSplash} />}
      <TooltipLayer />
    </div>
  );
}
