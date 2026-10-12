import { useCallback, useEffect, useRef, useState } from 'react';
import { GameController, type Note, type Snapshot } from '../game/controller';
import type { PlayerId } from '../engine/types';
import type { BoardView } from '../view/BoardView';
import { ActionPanel } from './ActionPanel';
import { CHAINS, type Difficulty } from './chains';
import { GameHud, LogPanel } from './GameHud';
import { MainMenu, type NewGame } from './MainMenu';
import { DinnerReportModal, MilestoneBoard, PlayerDrawer, StaffModal, type Toast, Toasts } from './Overlays';

let toastSeq = 0;

export function App({ board }: { board: BoardView }) {
  const ctrl = useRef<GameController | null>(null);
  const [snap, setSnap] = useState<Snapshot>();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [drawer, setDrawer] = useState<PlayerId | null>(null);
  const [milestones, setMilestones] = useState(false);
  const [staff, setStaff] = useState(false);
  const [reportSeen, setReportSeen] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => () => ctrl.current?.dispose(), []);

  const pushNotes = useCallback((notes: Note[], human: PlayerId) => {
    const shown = notes.filter((n) => (n.kind !== 'production' && n.kind !== 'staff') || n.player === human);
    if (!shown.length) return;
    const added = shown.map((n) => ({ ...n, id: ++toastSeq }));
    setToasts((t) => [...t, ...added].slice(-4));
    for (const a of added) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), a.kind === 'production' || a.kind === 'staff' ? 2600 : 5200);
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
      board.sync(s.view);
      board.animateEvents(events);
      pushNotes(notes, c.human);
      const phases = events.flatMap((e) => (e.type === 'phase' ? [e.phase] : []));
      if (phases.includes('clean-up')) {
        board.setTimeOfDay('night', 0.6);
        setTimeout(() => board.setTimeOfDay('day', 1.2), 900);
      } else if (phases.includes('dinnertime')) board.setTimeOfDay('dusk', 1);
      setSnap(s);
    });
    ctrl.current = c;
    setDifficulty(difficulty);
    setReportSeen(0);
    setToasts([]);
    setSnap(c.current);
    c.start();
  };

  const quit = () => {
    ctrl.current?.dispose();
    ctrl.current = null;
    setSnap(undefined);
    setDrawer(null);
    setMilestones(false);
    board.setTargets(null);
    board.setMode('menu');
    board.setTimeOfDay('dusk');
  };

  const c = ctrl.current;
  const report =
    snap?.report && snap.report.round > reportSeen && (snap.report.served.length > 0 || snap.report.waitresses.some((x) => x > 0) || snap.report.bankBroken > 0)
      ? snap.report
      : null;
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
          />
          <aside className="side">
            <ActionPanel view={snap.view} me={c.human} board={board} stats={snap.stats[c.human]} act={(a) => c.act(a)} />
            <LogPanel view={snap.view} log={snap.log} />
          </aside>
          <Toasts view={snap.view} toasts={toasts} me={c.human} />
          {drawer !== null && <PlayerDrawer view={snap.view} id={drawer} me={c.human} stats={snap.stats[drawer]} onClose={() => setDrawer(null)} />}
          {milestones && <MilestoneBoard view={snap.view} onClose={() => setMilestones(false)} />}
          {staff && <StaffModal view={snap.view} onClose={() => setStaff(false)} />}
          {report && drawer === null && !milestones && !staff && <DinnerReportModal view={snap.view} report={report} me={c.human} onClose={() => setReportSeen(report.round)} />}
        </>
      ) : (
        <MainMenu onStart={start} />
      )}
    </div>
  );
}
