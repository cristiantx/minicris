import * as THREE from 'three';
import { CameraManager } from './CameraManager';
import { InputManager } from './InputManager';
import { Character } from './Character';

export class Game {
    private container: HTMLElement;
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;
    public cameraManager: CameraManager;
    public inputManager: InputManager;
    public character: Character | null = null;
    public dirLight: THREE.DirectionalLight | null = null;
    
    private clock: THREE.Clock;

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
        this.renderer.shadowMap.type = THREE.VSMShadowMap; // Switch to VSM for soft shadows
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Better colors
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic look
        this.renderer.toneMappingExposure = 1.2;
        
        this.container.appendChild(this.renderer.domElement);

        // Sub-systems
        this.cameraManager = new CameraManager(this);
        this.inputManager = new InputManager(this.container);

        this.initScene();
        
        // Start Loop
        this.animate();

        // Handle Resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private initScene() {
        // Background - Soft Sky
        this.scene.background = new THREE.Color(0xadd8e6); // Lighter sky
        this.scene.fog = new THREE.Fog(0xadd8e6, 30, 100);

        // Lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        this.scene.add(hemiLight);

        // Main Directional Light (Sun)
        this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        this.dirLight.position.set(20, 40, 20); // Higher and more offset
        this.dirLight.castShadow = true;
        
        // High resolution shadow map
        this.dirLight.shadow.mapSize.width = 4096;
        this.dirLight.shadow.mapSize.height = 4096;
        
        // Tight frustum for maximum pixel density around player
        const shadowSize = 15;
        this.dirLight.shadow.camera.near = 1;
        this.dirLight.shadow.camera.far = 100;
        this.dirLight.shadow.camera.left = -shadowSize;
        this.dirLight.shadow.camera.right = shadowSize;
        this.dirLight.shadow.camera.top = shadowSize;
        this.dirLight.shadow.camera.bottom = -shadowSize;
        
        // Bias tuning for VSM
        this.dirLight.shadow.bias = -0.0001;
        this.dirLight.shadow.normalBias = 0.02; 
        
        // VSM Softness settings
        this.dirLight.shadow.blurSamples = 8;
        this.dirLight.shadow.radius = 4;
        
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
        this.character.load();
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

        if (this.character) {
            this.character.update(delta, this.inputManager.inputVector);
            this.cameraManager.follow(this.character.position, delta);

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
