import * as THREE from 'three';

import { CameraManager } from './CameraManager';
import { InputManager } from './InputManager';
import { Character } from './Character';
import { GameState, type GameStateType } from './GameState';
import { MainMenuUI } from './MainMenuUI';
import { GameConfig } from './GameConfig';
import { LevelManager } from './LevelManager';

export class Game {
    private container: HTMLElement;
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;
    public cameraManager: CameraManager;
    public inputManager: InputManager;
    public character: Character | null = null;
    public dirLight: THREE.DirectionalLight | null = null;
    
    public state: GameStateType = GameState.SPLASH;
    private ui: MainMenuUI;
    private clock: THREE.Clock;

    // Performance & Debug
    private fpsElement: HTMLDivElement | null = null;
    private frameCount: number = 0;
    private lastTime: number = 0;

    // Assets
    public levelManager: LevelManager;

    constructor(container: HTMLElement) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.levelManager = new LevelManager(this.scene);

        // Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance' 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Enhancing visual quality
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Switch to PCF Soft Shadows for better stability
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        this.container.appendChild(this.renderer.domElement);

        // Sub-systems
        this.cameraManager = new CameraManager(this);
        this.inputManager = new InputManager(this.container);
        this.ui = new MainMenuUI(this.container);

        this.initMenuScene();
        this.initUI();
        
        // Start Loop
        this.animate();

        // Handle Resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private initUI() {
        this.inputManager.enabled = false; // Disable joystick in menu
        this.ui.onStartGame = () => this.startGame();
        this.ui.onOptions = () => console.log("Options clicked");
        this.ui.show();

        if (GameConfig.SHOW_FPS) {
            this.fpsElement = document.createElement('div');
            this.fpsElement.className = 'fps-counter';
            this.fpsElement.style.display = 'block';
            this.container.appendChild(this.fpsElement);
        }
    }

    private async startGame() {
        if (this.state !== GameState.SPLASH) return;
        
        // Show loading state if needed, or just freeze UI
        // For now, let's just proceed.
        
        this.state = GameState.TRANSITIONING;
        this.ui.hide(); 

        // Load the heavy level async
        await this.loadLevel();
        
        // Immediate Transition
        this.cameraManager.setView('GAMEPLAY');
        this.state = GameState.GAMEPLAY;
        this.inputManager.enabled = true; // Enable joystick once game starts
    }

    private initMenuScene() {
        // Background - Keep it simple or match the grassy theme
        const skyColor = 0x55aa55; 
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.FogExp2(skyColor, 0.01);

        // Simple Lighting for Menu (just enough to see if we had anything, but we don't really have 3D objects in menu yet except maybe background)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        this.scene.add(hemiLight);
    }

    private async loadLevel() {
        // 1. Clear Menu Scene
        this.scene.clear();

        // 2. Setup Gameplay Scene (Lights, Fog)
        const skyColor = 0x55aa55; 
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.FogExp2(skyColor, 0.002);

        // Lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        this.scene.add(hemiLight);

        // Main Directional Light (Sun)
        this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        this.dirLight.position.set(20, 40, 20); 
        this.dirLight.castShadow = true;
        
        // High resolution shadow map
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        
        // Tight frustum
        const shadowSize = 30; // Increased for larger maps
        this.dirLight.shadow.camera.near = 1;
        this.dirLight.shadow.camera.far = 100;
        this.dirLight.shadow.camera.left = -shadowSize;
        this.dirLight.shadow.camera.right = shadowSize;
        this.dirLight.shadow.camera.top = shadowSize;
        this.dirLight.shadow.camera.bottom = -shadowSize;
        
        this.dirLight.shadow.bias = -0.0005;
        this.dirLight.shadow.normalBias = 0.05; 
        
        this.scene.add(this.dirLight);

        // Secondary Soft Light
        const fillLight = new THREE.PointLight(0xffd700, 1.0, 50); 
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);

        // 3. Load Level Data & Assets
        await this.levelManager.loadLevel('/assets/levels/level1.json');

        // 4. Load Character
        this.character = new Character(this);
        await this.character.load();
        
        if (this.character) {
             // Set spawn
             const spawn = this.levelManager.getPlayerSpawn();
             this.character.position.copy(spawn);
             if (this.character.mesh) this.character.mesh.position.copy(spawn);
             
             // Instantly idle
             this.character.fadeToAction('idle', 0);
        }
    }

    private onWindowResize() {
        this.cameraManager.resize();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();
        const time = performance.now();

        // FPS Counter Logic
        this.frameCount++;
        if (time >= this.lastTime + 1000) {
            if (this.fpsElement) {
                this.fpsElement.innerText = `FPS: ${Math.round((this.frameCount * 1000) / (time - this.lastTime))}`;
            }
            this.frameCount = 0;
            this.lastTime = time;
        }

        if (this.character && this.state !== GameState.SPLASH) {
            if (this.state === GameState.GAMEPLAY) {
                this.character.update(delta, this.inputManager.inputVector);
                this.cameraManager.follow(this.character.position, delta);
            } else {
                // Just update animation mixer in other states
                this.character.mixer?.update(delta);
                // In transitioning, follow with higher lerp
                this.cameraManager.follow(this.character.position, delta, 5);
            }

            // Follow the character with the light to keep the high-quality shadow area centered
            if (this.dirLight) {
                this.dirLight.position.x = this.character.position.x + 20;
                this.dirLight.position.z = this.character.position.z + 20;
                this.dirLight.target.position.copy(this.character.position);
                this.dirLight.target.updateMatrixWorld();
            }
        }

        this.renderer.render(this.scene, this.cameraManager.camera);
    }
}
