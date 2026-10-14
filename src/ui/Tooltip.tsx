import { useEffect, useState } from 'react';

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

/** Shows `data-tip` text for any hovered element, plus board tips sent via `showBoardTip`. */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let el: HTMLElement | null = null;
    const over = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (target === el) return;
      el = target;
      if (!target?.dataset.tip) return setTip(null);
      const r = target.getBoundingClientRect();
      const below = r.top < 140;
      setTip({ text: target.dataset.tip, x: r.left + r.width / 2, y: below ? r.bottom + 10 : r.top - 10, below });
    };
    const board = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; x: number; y: number } | null>).detail;
      setTip(d ? { text: d.text, x: d.x, y: d.y - 18, below: d.y < 200 } : null);
    };
    const clear = () => {
      el = null;
      setTip(null);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('click', clear, true);
    window.addEventListener('board-tip', board);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('click', clear, true);
      window.removeEventListener('board-tip', board);
    };
  }, []);

  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 170), window.innerWidth - 170);
  return (
    <div className={`tooltip ${tip.below ? 'below' : ''}`} style={{ left, top: tip.y }}>
      {tip.text}
    </div>
  );
}

export function showBoardTip(text: string | null, x = 0, y = 0): void {
  window.dispatchEvent(new CustomEvent('board-tip', { detail: text ? { text, x, y } : null }));
}
