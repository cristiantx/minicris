import './style.css'
import { Game } from './Game.ts'

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container') as HTMLElement;
  if (container) {
    const game = new Game(container);
    // Expose game to window for debugging if needed
    (window as any).game = game;
  }
});
