import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

    // Assets
    private models: { [key: string]: THREE.Group } = {};

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

        // 2. Setup Gameplay Scene (Lights, Ground, Fog)
        const skyColor = 0x55aa55; 
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.FogExp2(skyColor, 0.002);

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
        
        // Tight frustum
        const shadowSize = 15;
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

        // Ground
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x55aa55, depthWrite: true })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // 3. Load Character
        // We load Character first or parallel with props
        this.character = new Character(this);
        const charLoadPromise = this.character.load().then(() => {
            if (this.character) {
                // Instantly idle
                this.character.fadeToAction('idle', 0);
            }
        });

        // 4. Load & Scatter Props
        await this.prepareModels();
        this.scatterProps();

        // Wait for character
        await charLoadPromise;
    }

    private async prepareModels() {
        // Preload GLBs
        const loader = new GLTFLoader();
        const modelNames = ['tree-pine.glb', 'tree-1.glb', 'tree-2.glb', 'tree-3.glb', 'rocks.glb'];

        const loadPromises = modelNames.map(async (name) => {
            try {
                const gltf = await loader.loadAsync(`/models/${name}`);
                const model = gltf.scene;
                
                // 1. Normalize Scale
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());

                // Default target height
                let targetHeight = 5.0; 

                if (name.includes('rock')) {
                    targetHeight = 0.75; // Rocks smaller (was 1.5)
                } else if (name.includes('tree')) {
                    targetHeight = 6.0; 
                }

                if (size.y > 0) {
                    const scale = targetHeight / size.y;
                    model.scale.setScalar(scale);
                }

                // 2. Fix Pivot (Center Bottom)
                // We wrap the model in a group and offset it so the bottom is at y=0
                const wrapper = new THREE.Group();
                
                // Recalculate box after scaling
                const finalBox = new THREE.Box3().setFromObject(model);
                
                // Offset calculation: we want bottom (box.min.y) to be at 0.
                // So we move the model UP by -box.min.y
                model.position.y = -finalBox.min.y;
                
                wrapper.add(model);

                // Configure materials/shadows for the model
                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.models[name] = wrapper;
            } catch (err) {
                console.error(`Failed to load model: ${name}`, err);
            }
        });

        await Promise.all(loadPromises);
    }

    private scatterProps() {
        const modelKeys = Object.keys(this.models);
        if (modelKeys.length === 0) return;

        // Use a set to keeping track of positions to avoid overlap could be good, 
        // but simple random with distance check is fine for now.
        
        for (let i = 0; i < 50; i++) {
            const x = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;
            
            // Avoid center (Player spawn area)
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

            const randomKey = modelKeys[Math.floor(Math.random() * modelKeys.length)];
            const original = this.models[randomKey];
            
            if (original) {
                const clone = original.clone();
                clone.position.set(x, 0, z);
                clone.rotation.y = Math.random() * Math.PI * 2;
                
                // Random scale variation
                const randomVariation = 0.8 + Math.random() * 0.6; 
                clone.scale.multiplyScalar(randomVariation);

                this.scene.add(clone);
            }
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
