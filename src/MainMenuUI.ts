import { GameConfig } from './GameConfig';

export class MainMenuUI {
    private container: HTMLElement;
    private menuRoot: HTMLDivElement;
    
    public onStartGame: () => void = () => {};
    public onOptions: () => void = () => {};

    constructor(container: HTMLElement) {
        this.container = container;
        this.menuRoot = document.createElement('div');
        this.menuRoot.id = 'main-menu';
        this.render();
    }

    private render() {
        this.menuRoot.innerHTML = `
            <div class="menu-content fade-in-up">
                <div class="title-group">
                    <h1 class="game-title">${GameConfig.GAME_TITLE}</h1>
                    <p class="game-subtitle">A Tiny Adventure</p>
                </div>
                <div class="menu-buttons">
                    <button id="btn-start" class="menu-btn primary">
                        <span class="btn-text">START ADVENTURE</span>
                    </button>
                    <button id="btn-options" class="menu-btn secondary">
                        <span class="btn-text">OPTIONS</span>
                    </button>
                </div>
            </div>
        `;

        this.container.appendChild(this.menuRoot);

        const startBtn = this.menuRoot.querySelector('#btn-start');
        const optionsBtn = this.menuRoot.querySelector('#btn-options');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.onStartGame?.());
            startBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.onStartGame?.();
            }, { passive: false });
        }
        
        if (optionsBtn) {
            optionsBtn.addEventListener('click', () => this.onOptions?.());
            optionsBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.onOptions?.();
            }, { passive: false });
        }
    }

    public show() {
        this.menuRoot.classList.remove('hidden');
        this.menuRoot.classList.add('fade-in');
    }

    public hide() {
        this.menuRoot.classList.add('fade-out');
        setTimeout(() => {
            this.menuRoot.classList.add('hidden');
            this.menuRoot.classList.remove('fade-out');
        }, 500);
    }
}
