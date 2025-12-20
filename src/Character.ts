import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Game } from './Game';

export class Character {
    private game: Game;
    public mesh: THREE.Group | null = null;
    public mixer: THREE.AnimationMixer | null = null;
    
    // Actions
    private actions: { [key: string]: THREE.AnimationAction } = {};
    private activeAction: THREE.AnimationAction | null = null;

    // State
    public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    // private speed: number = 0;
    private maxSpeed: number = 10; // Run speed
    private walkSpeed: number = 4; // Walk speed

    constructor(game: Game) {
        this.game = game;
    }

    public async load() {
        const loader = new FBXLoader();

        try {
            // 1. Load Model
            const fbxtmp = await loader.loadAsync('/models/character.fbx');
            this.mesh = fbxtmp;
            
            // Normalize Scale (FBX often have weird scales)
            // Assuming 1 unit = 1 meter. If model is huge, scale down.
            // Let's create a bounding box to check size.
            const box = new THREE.Box3().setFromObject(this.mesh);
            const size = box.getSize(new THREE.Vector3());

            // Scale logic: If huge (e.g. 100+), scale down. If tiny (e.g. < 1), scale up?
            // Let's try to normalize height to ~2 units.
            if (size.y > 0) {
                const scale = 2 / size.y;
                this.mesh.scale.setScalar(scale);
            } else {
                this.mesh.scale.setScalar(0.01);
            }

            this.mesh.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // (child as THREE.Mesh).material = debugMat; // Uncomment if textures are missing and model is invisible
                }
            });

            if (this.mesh) {
                this.game.scene.add(this.mesh);
                this.mesh.visible = false; // Initially hide to avoid T-pose
                this.position.copy(this.mesh.position);

                // 2. Setup Animations
                this.mixer = new THREE.AnimationMixer(this.mesh);
            }
            
                if (this.mixer) {
                    // Load animations in parallel for better performance
                    const [walkFbx, runFbx, idleFbx, boredFbx, laiddownFbx, standupFbx] = await Promise.all([
                        loader.loadAsync('/animations/walking.fbx'),
                        loader.loadAsync('/animations/running.fbx'),
                        loader.loadAsync('/animations/idle.fbx'),
                        loader.loadAsync('/animations/bored.fbx'),
                        loader.loadAsync('/animations/laiddown.fbx'),
                        loader.loadAsync('/animations/standup.fbx')
                    ]);

                    // Helper to register animation
                    const registerAction = (fbx: any, name: string, loop: boolean = true) => {
                        const clip = fbx.animations[0];
                        if (clip) {
                            clip.name = name;
                            this.actions[name] = this.mixer!.clipAction(clip);
                            if (!loop) {
                                this.actions[name].loop = THREE.LoopOnce;
                                this.actions[name].clampWhenFinished = true;
                            }
                        }
                    };

                    registerAction(walkFbx, 'walk');
                    registerAction(runFbx, 'run');
                    registerAction(idleFbx, 'idle');
                    registerAction(boredFbx, 'bored', false);
                    registerAction(laiddownFbx, 'laiddown');
                    registerAction(standupFbx, 'standup', false);

                    // Setup Idle as default
                    if (this.actions['idle']) {
                        // Start Idle and Reveal Model
                        this.activeAction = this.actions['idle'];
                        this.activeAction.play();
                        
                        if (this.mesh) {
                            this.mesh.visible = true;
                        }
                    }

                    // listener to return to idle after one-shots
                    this.mixer.addEventListener('finished', (e: any) => {
                        if (e.action === this.actions['bored']) {
                            this.fadeToAction('idle', 0.5);
                            this.idleTimer = 0; // Reset timer
                        }
                    });
                }

            console.log("Character Loaded", this.actions);

        } catch (e) {
            console.error("Error loading character:", e);
        }
    }

    // State Variables
    private idleTimer: number = 0;
    // private isBored: boolean = false;

    public update(delta: number, input: THREE.Vector2) {
        if (!this.mesh || !this.mixer) return;

        this.mixer.update(delta);

        let moveVec = new THREE.Vector3(0, 0, 0);
        const inputMag = input.length();

        if (inputMag > 0.01) {
            // Movement Logic
            this.idleTimer = 0; // Reset bored timer

            // Calculate Direction
            const camForward = new THREE.Vector3();
            this.game.cameraManager.camera.getWorldDirection(camForward);
            camForward.y = 0;
            camForward.normalize();

            const camRight = new THREE.Vector3();
            camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

            moveVec.addScaledVector(camRight, input.x);
            moveVec.addScaledVector(camForward, input.y);
            
            if (moveVec.lengthSq() > 0) moveVec.normalize();

            // Determine Speed & Animation
            // Thresholds: 1% to 30% -> Walk. > 30% -> Run.
            let targetSpeed = 0;
            let targetAnim = 'idle';

            if (inputMag < 0.3) {
                // Walk
                // Map 0.01..0.3 to Speed Range? Or constant walk speed?
                // "Speed of the character should be incremental as well"
                // Let's map magnitude to speed.
                // 0.01 -> 0.3 covers WalkSpeedRange (e.g. 0.5 -> 4)
                 targetAnim = 'walk';
                 const t = (inputMag - 0.01) / (0.3 - 0.01); // 0 to 1
                 targetSpeed = THREE.MathUtils.lerp(0.5, this.walkSpeed, t);
            } else {
                // Run
                // 0.3 -> 1.0 covers RunSpeedRange (e.g. 4 -> 10)
                targetAnim = 'run';
                const t = (inputMag - 0.3) / (1.0 - 0.3); // 0 to 1
                targetSpeed = THREE.MathUtils.lerp(this.walkSpeed, this.maxSpeed, t);
            }

            // Apply movement
            const moveStep = moveVec.multiplyScalar(targetSpeed * delta);
            this.position.add(moveStep);
            this.mesh.position.copy(this.position);

            // Rotation
            const targetRotation = Math.atan2(moveVec.x, moveVec.z);
            const rotQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), targetRotation);
            this.mesh.quaternion.slerp(rotQ, 10 * delta);

            // Animation Transition
            this.fadeToAction(targetAnim, 0.2);

        } else {
            // Stop / Idle Logic
            if (this.activeAction !== this.actions['bored']) {
                 this.fadeToAction('idle', 0.2);
            }
            
            // Bored Logic
            this.idleTimer += delta;
            if (this.idleTimer > 15.0) {
                 // Play bored
                 if (this.activeAction !== this.actions['bored'] && this.actions['bored']) {
                      this.fadeToAction('bored', 0.5);
                 }
            }
        }
    }

    public playOneShotAnimation(name: string, fadeOutDuration: number = 0.5): Promise<void> {
        return new Promise((resolve) => {
            if (!this.actions[name] || !this.mixer) {
                resolve();
                return;
            }

            const action = this.actions[name];
            this.fadeToAction(name, fadeOutDuration);

            const onFinished = (e: any) => {
                if (e.action === action) {
                    this.mixer!.removeEventListener('finished', onFinished);
                    resolve();
                }
            };

            this.mixer.addEventListener('finished', onFinished);
        });
    }

    public fadeToAction(name: string, duration: number) {
        if (!this.actions[name]) return; // Action doesn't exist?
        const nextAction = this.actions[name];
        
        if (this.activeAction !== nextAction) {
            // Fade out current
            if (this.activeAction) {
                this.activeAction.fadeOut(duration);
            }
            // Fade in next
            nextAction.reset().fadeIn(duration).play();
            this.activeAction = nextAction;
        }
    }
}
