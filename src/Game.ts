import * as THREE from 'three';
import { CameraManager } from './CameraManager';
import { InputManager } from './InputManager';
import { Character } from './Character';
import { GameState, type GameStateType } from './GameState';
import { MainMenuUI } from './MainMenuUI';
import { GameConfig } from './GameConfig';

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

    constructor(container: HTMLElement) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

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

        this.initScene();
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
        if (this.state !== GameState.SPLASH || !this.character) return;
        
        this.state = GameState.TRANSITIONING;
        this.ui.hide();
        
        // Play standup animation and wait for it to finish
        await this.character.playOneShotAnimation('standup');
        
        // Transition camera and state
        this.cameraManager.setView('GAMEPLAY');
        this.state = GameState.GAMEPLAY;
        this.inputManager.enabled = true; // Enable joystick once game starts
    }

    private initScene() {
        // Background - Grassy Green
        const skyColor = 0x55aa55; 
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.FogExp2(skyColor, 0.01); // Reduced density significantly

        // Lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        this.scene.add(hemiLight);

        // Main Directional Light (Sun)
        this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        this.dirLight.position.set(20, 40, 20); // Higher and more offset
        this.dirLight.castShadow = true;
        
        // High resolution shadow map
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        
        // Tight frustum for maximum pixel density around player
        const shadowSize = 15;
        this.dirLight.shadow.camera.near = 1;
        this.dirLight.shadow.camera.far = 100;
        this.dirLight.shadow.camera.left = -shadowSize;
        this.dirLight.shadow.camera.right = shadowSize;
        this.dirLight.shadow.camera.top = shadowSize;
        this.dirLight.shadow.camera.bottom = -shadowSize;
        
        // Bias tuning for PCF
        this.dirLight.shadow.bias = -0.0005;
        this.dirLight.shadow.normalBias = 0.05; 
        
        this.scene.add(this.dirLight);

        // Secondary Soft Light for rim/fill
        const fillLight = new THREE.PointLight(0xffd700, 1.0, 50); // Golden hint
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);

        // Ground
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x55aa55, depthWrite: true })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Environment Props (Trees/Rocks)
        this.addProps();

        // Character (Async load)
        this.character = new Character(this);
        this.character.load().then(() => {
            if (this.state === GameState.SPLASH && this.character) {
                this.character.fadeToAction('laiddown', 0);
            }
        });
    }

    private addProps() {
        // Add random trees (Cylinders)
        const treeGeo = new THREE.CylinderGeometry(0, 1.5, 5, 8);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x228b22, flatShading: true });
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

        for (let i = 0; i < 50; i++) {
            const x = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;
            
            // Avoid center
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

            const group = new THREE.Group();
            
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const leaves = new THREE.Mesh(treeGeo, treeMat);
            leaves.position.y = 3.5;
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            group.add(leaves);

            group.position.set(x, 0, z);
            group.rotation.y = Math.random() * Math.PI;
            
            const scale = 0.8 + Math.random() * 0.4;
            group.scale.setScalar(scale);

            this.scene.add(group);
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

        if (this.character) {
            if (this.state === GameState.GAMEPLAY) {
                this.character.update(delta, this.inputManager.inputVector);
                this.cameraManager.follow(this.character.position, delta);
            } else {
                // Just update animation mixer in other states
                this.character.mixer?.update(delta);
                // In splash/transitioning, follow with higher lerp or different logic if needed
                this.cameraManager.follow(this.character.position, delta, 10);
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
