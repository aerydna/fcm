import '@fontsource/pacifico/400.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './ui/styles.css';
import { createRoot } from 'react-dom/client';
import { randomMap } from './engine/map';
import { App } from './ui/App';
import { BoardView } from './view/BoardView';

await Promise.all([document.fonts.load('700 16px Fredoka'), document.fonts.load('400 16px Pacifico')]);

const board = await BoardView.create(document.getElementById('board')!);
board.setMap(randomMap(20151, 4, 3));
board.setMode('menu');
board.setTimeOfDay('dusk', 0);
// Dev-only handle for browser automation.
if (import.meta.env.DEV) (window as unknown as { __board: BoardView }).__board = board;

createRoot(document.getElementById('ui')!).render(<App board={board} />);
