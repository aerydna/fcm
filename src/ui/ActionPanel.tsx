import { useEffect, useMemo, useState } from 'react';
import { CAMPAIGN_TILES, EMPLOYEES, GOODS, type Good } from '../engine/data';
import { actionYield } from '../engine/game';
import { legalActions } from '../engine/legal';
import { recruitActions, salaryDue, typeOf } from '../engine/rules';
import type { Action, GameState, PlayerId, Rect } from '../engine/types';
import { entranceSquares } from '../engine/geometry';
import type { TurnStats } from '../game/controller';
import { type BoardView, GOOD_ICON, type Target } from '../view/BoardView';
import { CHAINS } from './chains';
import { EmployeeCard } from './EmployeeCard';
import { chainName, empName, reserveLabel, STEP_LABEL, CAMPAIGN_HELP } from './labels';
import { GOOD_NAME } from './icons';
import { reachedHouses } from '../engine/marketing';
import { RestructureBoard } from './RestructureBoard';

type Of<T extends Action['type']> = Extract<Action, { type: T }>;

interface Props {
  view: GameState;
  me: PlayerId;
  board: BoardView;
  stats?: TurnStats;
  /** True while phase animations play: hide overlays that would cover the board. */
  paused?: boolean;
  act: (a: Action) => string | null;
}

export function ActionPanel({ view, me, board, stats, paused, act }: Props) {
  const myTurn = view.active === me;
  const actions = useMemo(() => (myTurn ? legalActions(view) : []), [view, myTurn]);
  const [error, setError] = useState<string | null>(null);
  const color = CHAINS.find((c) => c.id === view.players[me].chain)?.color;
  const run = (a: Action) => setError(act(a));
  const pick = (list: Action[], toTarget: (a: Action) => Target['rects'], marks?: (a: Action) => Target['marks'], highlights?: (a: Action) => Rect[]) => {
    board.setTargets(
      list.map((a, id) => ({ id, rects: toTarget(a), marks: marks?.(a), highlights: highlights?.(a) })),
      (id) => run(list[id]),
      color,
    );
  };

  useEffect(() => () => board.setTargets(null), [board]);
  useEffect(() => setError(null), [view.phase, view.workStep, view.active]);
  const usesMap = myTurn && (view.phase === 'setup-restaurant' || (view.phase === 'working' && [2, 4, 5].includes(view.workStep)));
  useEffect(() => {
    if (!usesMap) board.setTargets(null);
  }, [usesMap, view, board]);

  if (view.phase === 'game-over') return <GameOver view={view} />;
  if (!myTurn) {
    return (
      <div className="panel waiting">
        <div className="spinner" />
        <span>{view.active !== null ? `${chainName(view, view.active)} is thinking\u2026` : 'Resolving\u2026'}</span>
      </div>
    );
  }

  const of = <T extends Action['type']>(t: T) => actions.filter((a): a is Of<T> => a.type === t);
  const end = actions.find((a) => a.type === 'endStep');
  const body = (() => {
    switch (view.phase) {
      case 'setup-restaurant':
        return <SetupRestaurant view={view} places={of('placeRestaurant')} pass={of('pass')[0]} pick={pick} run={run} />;
      case 'setup-reserve':
        return (
          <Section title="Choose your bank reserve" hint="Secret. Sets how much money refills the bank and the CEO slots after it breaks.">
            <div className="choices">
              {of('chooseReserve').map((a) => (
                <button key={a.index} className="choice" onClick={() => run(a)} data-tip="Secret until the bank breaks. Money refills the bank (bigger = longer game); the most common slot number becomes every CEO's slots.">
                  {reserveLabel(a.index)}
                </button>
              ))}
            </div>
          </Section>
        );
      case 'restructuring':
        return <Restructure view={view} me={me} run={run} paused={paused} />;
      case 'order-of-business':
        return (
          <Section title="Order of business" hint="Pick your position in turn order.">
            <div className="choices">
              {of('chooseOrder').map((a) => (
                <button key={a.position} className="choice" onClick={() => run(a)} data-tip="Earlier positions act first in Working 9-5 and win Dinnertime ties.">
                  {a.position + 1}
                  {['st', 'nd', 'rd', 'th', 'th'][a.position]}
                </button>
              ))}
            </div>
          </Section>
        );
      case 'working':
        return <Working view={view} me={me} actions={actions} of={of} pick={pick} run={run} board={board} stats={stats} />;
      case 'payday':
        return <Payday view={view} me={me} actions={actions} run={run} />;
      default:
        return null;
    }
  })();

  return (
    <div className="panel">
      {body}
      {error && <div className="error">{error}</div>}
      {end && (
        <button className="cta small done" onClick={() => run(end)} data-tip={view.phase === 'working' ? `Finish "${STEP_LABEL[view.workStep]}" and move to the next step.` : 'Continue.'}>
          Done &rarr;
        </button>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

const rect2 = (x: number, y: number): Rect => ({ x, y, w: 2, h: 2 });

type PickFn = (list: Action[], toTarget: (a: Action) => Rect[], marks?: (a: Action) => Target['marks'], highlights?: (a: Action) => Rect[]) => void;

function SetupRestaurant({ view, places, pass, pick, run }: { view: GameState; places: Of<'placeRestaurant'>[]; pass?: Action; pick: PickFn; run: (a: Action) => void }) {
  useEffect(() => {
    pick(places, (a) => [rect2((a as Of<'placeRestaurant'>).x, (a as Of<'placeRestaurant'>).y)], (a) => entranceSquares(a as Of<'placeRestaurant'>, false));
  }, [places]);
  return (
    <Section title="Place your first restaurant" hint="Click a highlighted square. R or right-click rotates the entrance (white dot). Entrance must touch a road; one entrance per tile.">
      {view.setupRound === 2 && <p className="hint">Second round: you must place now.</p>}
      {pass && (
        <button className="ghost" onClick={() => run(pass)} data-tip="Skip for now: you will place after the others (but before anyone places a second time).">
          Pass (place later)
        </button>
      )}
    </Section>
  );
}

function Restructure({ view, me, run, paused }: { view: GameState; me: PlayerId; run: (a: Action) => void; paused?: boolean }) {
  const p = view.players[me];
  const [open, setOpen] = useState(true);
  return (
    <Section title="Restructuring" hint="Decide who works this turn and build your company pyramid.">
      <button className="cta small" onClick={() => setOpen(true)} data-tip="Open the drag-and-drop board to choose who works.">
        Open company board
      </button>
      {open && !paused && <RestructureBoard view={view} p={p} onReveal={run} onHide={() => setOpen(false)} />}
    </Section>
  );
}

function Recruit({ view, me, of, run, stats }: WorkingProps) {
  const p = view.players[me];
  const total = recruitActions(p);
  const used = p.turn.recruitsUsed;
  const [flash, setFlash] = useState<string | null>(null);
  const hire = (a: Of<'recruit'>) => {
    setFlash(a.employee);
    setTimeout(() => setFlash(null), 700);
    run(a);
  };
  return (
    <Section title="Recruit" hint="Hire entry-level employees. They go to the beach and can work from next turn.">
      <div className="hire-pips" data-tip="CEO gives 1 hire; recruiting girl +1, recruiting manager +2, HR director +4.">
        Hires
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`pip ${i < used ? 'used' : ''}`} />
        ))}
        <b>
          {total - used} left of {total}
        </b>
      </div>
      {stats && stats.hired.length > 0 && (
        <div className="hired">
          <small>Hired this turn:</small>
          {stats.hired.map((t, i) => (
            <EmployeeCard key={i} type={t} mini />
          ))}
        </div>
      )}
      <div className="cards">
        {of('recruit').map((a) => (
          <EmployeeCard key={a.employee} type={a.employee} selected={flash === a.employee} badge={`${view.supply[a.employee]} left`} onClick={() => hire(a)} />
        ))}
      </div>
    </Section>
  );
}

interface WorkingProps {
  view: GameState;
  me: PlayerId;
  actions: Action[];
  of: <T extends Action['type']>(t: T) => Of<T>[];
  pick: PickFn;
  run: (a: Action) => void;
  board: BoardView;
  stats?: TurnStats;
}

function Working(props: WorkingProps) {
  const { view, me, of, run } = props;
  const p = view.players[me];
  const title = STEP_LABEL[view.workStep];
  switch (view.workStep) {
    case 0:
      return <Recruit {...props} />;
    case 1:
      return (
        <Section title={title} hint="Promote employees on the beach one step along their career.">
          <div className="list">
            {of('train').map((a, i) => (
              <button key={i} className="row" onClick={() => run(a)} data-tip={`${empName(a.to)}: ${EMPLOYEES[a.to].ability}${EMPLOYEES[a.to].salary ? '\nCosts $5 salary every payday.' : ''}`}>
                {empName(typeOf(p, a.card))} &rarr; <b>{empName(a.to)}</b>
                <small> by {empName(typeOf(p, a.trainer))}</small>
              </button>
            ))}
          </div>
        </Section>
      );
    case 2:
      return <Marketing {...props} />;
    case 3:
      return (
        <Section title={title} hint="Produce food and collect drinks. Stock is shared by all your restaurants; leftovers are thrown away at clean-up.">
          <div className="list">
            {[...of('produce'), ...of('buyDrinks')].map((a, i) => {
              const got = actionYield(view, me, a);
              return (
                <button key={i} className="row yield" onClick={() => run(a)} data-tip={EMPLOYEES[typeOf(p, a.card)].ability}>
                  <span>{empName(typeOf(p, a.card))}</span>
                  <b>
                    {GOODS.filter((g) => got[g]).map((g) => `${GOOD_ICON[g]}×${got[g]}`).join('  ') || '—'}
                  </b>
                </button>
              );
            })}
          </div>
        </Section>
      );
    case 4:
      return <Houses {...props} />;
    case 5:
      return <Restaurants {...props} />;
    default:
      return null;
  }
}

function Marketing({ view, me, of, pick }: WorkingProps) {
  const p = view.players[me];
  const all = of('campaign');
  const marketeers = [...new Set(all.map((a) => a.marketeer))];
  const [marketeer, setMarketeer] = useState(marketeers[0]);
  const m = marketeers.includes(marketeer) ? marketeer : marketeers[0];
  const tiles = [...new Set(all.filter((a) => a.marketeer === m).map((a) => a.tile))];
  const [tile, setTile] = useState(tiles[0]);
  const t = tiles.includes(tile) ? tile : tiles[0];
  const [good, setGood] = useState<Good>('burger');
  const max = m ? EMPLOYEES[typeOf(p, m)].maxDuration ?? 1 : 1;
  const [duration, setDuration] = useState(max);
  const d = Math.min(duration, max);

  const options = useMemo(() => all.filter((a) => a.marketeer === m && a.tile === t && a.good === good).map((a) => ({ ...a, duration: d })), [all, m, t, good, d]);
  useEffect(() => {
    pick(
      options,
      (a) => {
        const c = a as Of<'campaign'>;
        if (c.rect) return [c.rect];
        const size = CAMPAIGN_TILES.find((x) => x.number === c.tile)!.size!;
        return c.band!.axis === 'row' ? [{ x: 0, y: c.band!.start, w: view.map.width, h: size }] : [{ x: c.band!.start, y: 0, w: size, h: view.map.height }];
      },
      undefined,
      (a) => {
        const c = a as Of<'campaign'>;
        const tile = CAMPAIGN_TILES.find((x) => x.number === c.tile)!;
        const fake = { number: c.tile, type: tile.type, owner: me, marketeer: 0, good: c.good, remaining: 1, eternal: false, rect: c.rect, band: c.band && { ...c.band, size: tile.size! } } as GameState['campaigns'][number];
        return reachedHouses(view, fake).map((h) => ({ x: h.x, y: h.y, w: 2, h: 2 }));
      },
    );
  }, [options]);

  const tileType = (n: number) => CAMPAIGN_TILES.find((x) => x.number === n)!.type;
  const def = m ? EMPLOYEES[typeOf(p, m)] : null;
  return (
    <Section title="Marketing" hint="Pick marketeer, campaign, product and duration, then click the map. Hover the map: the houses that will get demand light up. R / right-click rotates.">
      <div className="chips">
        {marketeers.map((u) => (
          <button key={u} className={`chip ${u === m ? 'on' : ''}`} onClick={() => setMarketeer(u)} data-tip={`${empName(typeOf(p, u))}: ${EMPLOYEES[typeOf(p, u)].ability}`}>
            {empName(typeOf(p, u))}
          </button>
        ))}
      </div>
      <div className="chips">
        {tiles.map((n) => (
          <button key={n} className={`chip ${n === t ? 'on' : ''}`} onClick={() => setTile(n)} data-tip={`${CAMPAIGN_HELP[tileType(n)]}\n#${n}: campaigns resolve from the lowest number up.`}>
            {tileType(n)} #{n}
          </button>
        ))}
      </div>
      {t !== undefined && <p className="hint campaign-help">{CAMPAIGN_HELP[tileType(t)]}</p>}
      <div className="chips">
        {GOODS.map((g) => (
          <button key={g} className={`chip big ${g === good ? 'on' : ''}`} onClick={() => setGood(g)} data-tip={`Advertise ${GOOD_NAME[g]}: houses reached will want ${GOOD_ICON[g]}. Only useful if you can produce or buy it.`}>
            {GOOD_ICON[g]}
          </button>
        ))}
      </div>
      <label className="slider" data-tip={`How many turns the campaign runs (1 demand token per turn per house). Max for this marketeer: ${def?.maxDuration ?? 1}. The marketeer is busy until it ends.`}>
        Duration <b>{d}</b>
        <input type="range" min={1} max={max} value={d} onChange={(e) => setDuration(Number(e.target.value))} />
      </label>
    </Section>
  );
}

function Houses({ of, pick }: WorkingProps) {
  const gardens = of('placeGarden');
  const houses = of('placeHouse');
  const [mode, setMode] = useState<'garden' | 'house'>(gardens.length ? 'garden' : 'house');
  useEffect(() => {
    if (mode === 'garden') pick(gardens, (a) => [(a as Of<'placeGarden'>).garden]);
    else pick(houses, (a) => [(a as Of<'placeHouse'>).house, (a as Of<'placeHouse'>).garden]);
  }, [mode, gardens.length, houses.length]);
  return (
    <Section title="Houses & gardens" hint="A garden doubles the price paid by that house and holds 5 demand. R / right-click cycles options.">
      <div className="chips">
        <button className={`chip ${mode === 'garden' ? 'on' : ''}`} onClick={() => setMode('garden')} disabled={!gardens.length} data-tip="Garden next to a printed house: that house pays double price and can hold 5 demand instead of 3.">
          Garden ({gardens.length ? 'available' : 'none'})
        </button>
        <button className={`chip ${mode === 'house' ? 'on' : ''}`} onClick={() => setMode('house')} disabled={!houses.length} data-tip="New house with garden anywhere next to a road: more customers on the map.">
          New house
        </button>
      </div>
    </Section>
  );
}

function Restaurants({ view, me, of, pick }: WorkingProps) {
  const places = of('placeRestaurant');
  const moves = of('moveRestaurant');
  const mine = view.restaurants.filter((r) => r.owner === me);
  const [moving, setMoving] = useState<number | null>(null);
  useEffect(() => {
    const list: Action[] = moving === null ? places : moves.filter((a) => a.restaurant === moving);
    pick(
      list,
      (a) => [rect2((a as Of<'placeRestaurant'>).x, (a as Of<'placeRestaurant'>).y)],
      (a) => entranceSquares(a as Of<'placeRestaurant'>, false),
    );
  }, [moving, places.length, moves.length]);
  return (
    <Section title="Restaurants" hint="Local manager: new restaurant within 3 tiles (opens next turn). Regional: anywhere, open now, or move one.">
      {moves.length > 0 && (
        <div className="chips">
          <button className={`chip ${moving === null ? 'on' : ''}`} onClick={() => setMoving(null)} data-tip="Place a new restaurant from your hand.">
            New ({view.players[me].restaurantsLeft} left)
          </button>
          {mine.map((r) => (
            <button key={r.id} className={`chip ${moving === r.id ? 'on' : ''}`} onClick={() => setMoving(r.id)} data-tip="Regional manager: pick up this restaurant and place it elsewhere (open immediately).">
              Move #{r.id}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function Payday({ view, me, actions, run }: { view: GameState; me: PlayerId; actions: Action[]; run: (a: Action) => void }) {
  const p = view.players[me];
  const due = salaryDue(p);
  const pay = actions.find((a) => a.type === 'endPayday');
  const fires = actions.filter((a): a is Of<'fire'> => a.type === 'fire');
  return (
    <Section title="Payday" hint={`Salaries due: $${due} \u00b7 cash $${p.cash}. Fire employees to save money (click a card).`}>
      <div className="cards">
        {fires.map((a) => (
          <EmployeeCard key={a.card} type={typeOf(p, a.card)} onClick={() => run(a)} title={`Fire ${empName(typeOf(p, a.card))}: back to the supply${EMPLOYEES[typeOf(p, a.card)].salary ? ', saves $5' : ' (no salary saved)'}.`} badge={'\u2715'} />
        ))}
      </div>
      {pay ? (
        <button className="cta small" onClick={() => run(pay)} data-tip="Pay $5 for every salaried card you own (at work, beach or busy), minus discounts.">
          Pay ${due} &rarr;
        </button>
      ) : (
        <p className="error">Not enough cash: fire someone.</p>
      )}
    </Section>
  );
}

function GameOver({ view }: { view: GameState }) {
  const ranking = [...view.players].sort((a, b) => b.cash - a.cash);
  return (
    <div className="panel">
      <Section title={`${chainName(view, view.winner ?? ranking[0].id)} wins!`}>
        <ol className="ranking">
          {ranking.map((p) => (
            <li key={p.id}>
              {chainName(view, p.id)} <b>${p.cash}</b>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
