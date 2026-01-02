export class LoadingUI {
    private container: HTMLElement;
    private element: HTMLDivElement;
    private progressBar: HTMLDivElement;
    private textElement: HTMLDivElement;

    constructor(container: HTMLElement) {
        this.container = container;
        
        this.element = document.createElement('div');
        this.element.id = 'loading-screen';
        this.element.className = 'hidden'; // Start hidden
        
        this.element.innerHTML = `
            <div class="loading-content">
                <div class="loading-text">Loading...</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill"></div>
                </div>
            </div>
        `;

        this.progressBar = this.element.querySelector('.progress-bar-fill') as HTMLDivElement;
        this.textElement = this.element.querySelector('.loading-text') as HTMLDivElement;

        this.container.appendChild(this.element);
    }

    public show() {
        this.element.classList.remove('hidden');
        this.updateProgress(0);
    }

    public hide() {
        this.element.style.opacity = '0';
        setTimeout(() => {
            this.element.classList.add('hidden');
            this.element.style.opacity = '1'; // Reset for next time
        }, 500);
    }

    public updateProgress(percent: number) {
        // Clamp between 0 and 100
        const p = Math.max(0, Math.min(100, percent));
        this.progressBar.style.width = `${p}%`;
        this.textElement.innerText = `Loading... ${Math.round(p)}%`;
    }
}
