import { useState } from 'react';
import { CHAINS, DIFFICULTIES, type Difficulty } from './chains';

export interface NewGame {
  chain: string;
  difficulty: Difficulty;
}

export function MainMenu({ onStart }: { onStart: (game: NewGame) => void }) {
  const [chain, setChain] = useState(CHAINS[1].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  return (
    <div className="menu">
      <h1 className="neon-title">
        <span className="neon-small">Food Chain</span>
        <span className="neon-big">Magnate</span>
      </h1>
      <p className="tagline">Build a fast-food empire. Out-hire, out-price, out-market.</p>

      <section className="card">
        <h2>Pick your chain</h2>
        <div className="chains">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              className={`chain ${c.id === chain ? 'selected' : ''}`}
              style={{ '--chain': c.color } as React.CSSProperties}
              onClick={() => setChain(c.id)}
              data-tip={`Play as ${c.name}. Chains differ only in color and logo.`}
            >
              <img src={c.logo} alt="" />
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <h2>Rival CPUs</h2>
        <div className="difficulties">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`difficulty ${d.id === difficulty ? 'selected' : ''}`} onClick={() => setDifficulty(d.id)} data-tip={`Both CPU rivals play at "${d.title}" level.`}>
              <strong>{d.title}</strong>
              <small>{d.blurb}</small>
            </button>
          ))}
        </div>

        <button className="cta" onClick={() => onStart({ chain, difficulty })} data-tip="Start a 3-player game: you vs 2 CPU chains on a random 4×3 map.">
          Open for business
        </button>
      </section>
    </div>
  );
}
