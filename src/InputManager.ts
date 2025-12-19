import * as THREE from 'three';

export class InputManager {
    public inputVector: THREE.Vector2 = new THREE.Vector2();
    private container: HTMLElement;
    
    // Joystick config
    private isTouching: boolean = false;
    private touchStart: THREE.Vector2 = new THREE.Vector2();
    private currentTouch: THREE.Vector2 = new THREE.Vector2();
    
    // DOM Elements for visual joystick
    private joystickBase!: HTMLDivElement;
    private joystickThumb!: HTMLDivElement;

    constructor(container: HTMLElement) {
        this.container = container;
        
        this.createJoystickUI();
        this.setupListeners();
    }

    private createJoystickUI() {
        this.joystickBase = document.createElement('div');
        this.joystickBase.id = 'joystick-base'; // ID for finding
        Object.assign(this.joystickBase.style, {
            position: 'absolute',
            width: '100px',
            height: '100px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            bottom: '50px',
            left: '50px',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            display: 'none',
            // display: 'block', // Debug
            pointerEvents: 'none', 
            // zIndex: '1000'
        });
        
        this.joystickThumb = document.createElement('div');
        Object.assign(this.joystickThumb.style, {
            position: 'absolute',
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
            left: '30px', 
            top: '30px',
            pointerEvents: 'none',
        });

        this.joystickBase.appendChild(this.joystickThumb);
        this.container.appendChild(this.joystickBase);
    }

    private setupListeners() {
        // Touch events
        this.container.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.container.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.container.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Mouse events (for testing on desktop)
        this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    // -- Touch Handlers --
    private onTouchStart(e: TouchEvent) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.startDragt(touch.clientX, touch.clientY);
    }

    private onTouchMove(e: TouchEvent) {
        e.preventDefault();
        if(!this.isTouching) return;
        const touch = e.changedTouches[0];
        this.updateDrag(touch.clientX, touch.clientY);
    }

    private onTouchEnd(e: TouchEvent) {
        e.preventDefault();
        this.endDrag();
    }

    // -- Mouse Handlers --
    private onMouseDown(e: MouseEvent) {
        this.startDragt(e.clientX, e.clientY);
    }

    private onMouseMove(e: MouseEvent) {
        if(!this.isTouching) return;
        this.updateDrag(e.clientX, e.clientY);
    }

    private onMouseUp(_e: MouseEvent) {
        this.endDrag();
    }

    // -- Logic --
    private startDragt(x: number, y: number) {
        this.isTouching = true;
        this.touchStart.set(x, y);
        this.currentTouch.set(x, y);

        // Show Joystick at touch position
        this.joystickBase.style.display = 'block';
        this.joystickBase.style.left = `${x - 50}px`;
        this.joystickBase.style.top = `${y - 50}px`;
        this.joystickThumb.style.transform = `translate(0px, 0px)`;
        
        this.updateInput();
    }

    private updateDrag(x: number, y: number) {
        this.currentTouch.set(x, y);
        
        // Calculate vector
        const diff = new THREE.Vector2().subVectors(this.currentTouch, this.touchStart);
        const maxDist = 40; // Joystick radius
        const dist = diff.length();
        
        // Clamp for UI
        if (dist > maxDist) {
            diff.normalize().multiplyScalar(maxDist);
        }

        // Update Thumb UI
        this.joystickThumb.style.transform = `translate(${diff.x}px, ${diff.y}px)`;

        // Update Input Vector
        // Normalized: -1 to 1 based on MaxDist
        // We want Full Range (1.0) at MaxDist.
        this.inputVector.set(diff.x / maxDist, -diff.y / maxDist);
    }

    private updateInput() {
        // Triggered on start/move
    }

    private endDrag() {
        this.isTouching = false;
        this.inputVector.set(0, 0);
        this.joystickBase.style.display = 'none'; // Hide on release
        this.joystickThumb.style.transform = `translate(0px, 0px)`;
    }
}
