
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Game } from './Game';
import { Character } from './Character';

export const EnemyState = {
    IDLE: 'IDLE', // Initial state or waiting
    PATROL: 'PATROL', // Moving to a random point
    CHASE: 'CHASE', // Running after player
    SEARCH: 'SEARCH' // Looking for player at last seen pos
} as const;

export type EnemyStateType = typeof EnemyState[keyof typeof EnemyState];

export class Enemy {
    private game: Game;
    public mesh: THREE.Group | null = null;
    public mixer: THREE.AnimationMixer | null = null;
    private actions: { [key: string]: THREE.AnimationAction } = {};
    private activeAction: THREE.AnimationAction | null = null;

    public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    private rotation: number = 0;
    private visualOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    // AI Params
    private state: EnemyStateType = EnemyState.PATROL;
    private subState: 'WALKING' | 'WAITING' = 'WALKING'; // For Patrol
    
    private movementSpeed: number = 0;
    private walkSpeed: number = 3.5;
    private runSpeed: number = 7.5;
    private sightRange: number = 10;
    private fieldOfView: number = 120;

    // Search / Patrol State
    private startPosition: THREE.Vector3 | null = null;
    private targetPosition: THREE.Vector3 | null = null;
    private lastSeenPosition: THREE.Vector3 | null = null;
    private stateTimer: number = 0;
    private waitTimer: number = 0; // For Idle behavior
    
    // Raycaster for sight
    private raycaster: THREE.Raycaster;

    constructor(game: Game) {
        this.game = game;
        this.raycaster = new THREE.Raycaster();
    }

    public async load() {
        const loader = new FBXLoader();
        try {
            // Load Mesh
            const gltf = await loader.loadAsync('/models/shovel-man.fbx');
            this.mesh = gltf;

            // Normalize Scale
            // Ensure matrices are updated for initial measurement
            this.mesh.updateMatrixWorld(true);
            let box = new THREE.Box3().setFromObject(this.mesh);
            let size = box.getSize(new THREE.Vector3());

            // Target height ~2.6 (30% bigger than the character's 2.0)
            if (size.y > 0) {
                const targetScale = 2.6 / size.y;
                this.mesh.scale.setScalar(targetScale);
            } else {
                this.mesh.scale.setScalar(1.0); // Fallback
            }

            this.mesh.traverse((c) => {
                if ((c as THREE.Mesh).isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            this.game.scene.add(this.mesh);
            this.mesh.visible = false;

            // Load Animations
            this.mixer = new THREE.AnimationMixer(this.mesh);

            const [walkFbx, runFbx, idleFbx, boredFbx] = await Promise.all([
                loader.loadAsync('/animations/shovel-walking.fbx'),
                loader.loadAsync('/animations/shovel-running.fbx'),
                loader.loadAsync('/animations/shovel-idle.fbx'),
                loader.loadAsync('/animations/shovel-bored.fbx')
            ]);

            const registerAction = (fbx: any, name: string) => {
                const clip = fbx.animations[0];
                if (clip) {
                    this.actions[name] = this.mixer!.clipAction(clip);
                }
            };

            registerAction(walkFbx, 'walk');
            registerAction(runFbx, 'run');
            registerAction(idleFbx, 'idle');
            registerAction(boredFbx, 'bored');

            // Default State
            this.fadeToAction('idle', 0);
            this.mesh.visible = true;

            console.log("Enemy Loaded");

        } catch (e) {
            console.error("Failed to load enemy", e);
        }
    }

    public update(delta: number) {
        if (!this.mesh || !this.mixer || !this.game.character) return;
        
        this.mixer.update(delta);
        
        // AI Logic
        this.updateState(delta);
        
        // Movement Logic
        this.updateMovement(delta);

        // Update Mesh Position with Offset
        this.mesh.position.copy(this.position).add(this.visualOffset);
        this.mesh.rotation.y = this.rotation;
    }

    private updateState(delta: number) {
        if (!this.game.character) return;
        
        const player = this.game.character;
        const distToPlayer = this.position.distanceTo(player.position);
        const canSee = this.checkSight(player);

        // State Machine
        switch (this.state) {
            case EnemyState.PATROL:
                if (canSee) {
                    this.state = EnemyState.CHASE;
                } else {
                    if (this.subState === 'WALKING') {
                         // Walking to target
                         if (!this.targetPosition) {
                             // Pick a target
                             this.patrolLogic();
                         }
                    } else if (this.subState === 'WAITING') {
                        // Waiting
                        this.waitTimer += delta;
                        
                        // Bored Logic
                        if (this.waitTimer > 15.0) {
                            this.fadeToAction('bored', 0.5);
                        } else {
                             this.fadeToAction('idle', 0.5);
                        }
                        
                        // Stop waiting after random time (e.g. 3-6s) or if bored finished?
                        // User said: "if it's idle for more than 15 seconds it will play the bored animation"
                        // So we wait at least 15s sometimes? 
                        // "after walking a while randomly it can also stand idle for a few seconds... if > 15 play bored"
                        // imply getting bored is rare or triggered by long wait.
                        // Let's randomize wait time.
                        if (this.waitTimer > this.stateTimer) {
                            this.subState = 'WALKING';
                            this.targetPosition = null; // trigger new walk
                        }
                    }
                }
                break;

            case EnemyState.CHASE:
                if (canSee) {
                     this.lastSeenPosition = player.position.clone();
                     this.targetPosition = player.position.clone();
                     
                     if (distToPlayer < 1.0) {
                         this.game.gameOver();
                         this.state = EnemyState.IDLE;
                     }

                } else {
                    this.state = EnemyState.SEARCH;
                    this.stateTimer = 5.0; 
                }
                break;
            
            case EnemyState.SEARCH:
                this.stateTimer -= delta;
                if (canSee) {
                    this.state = EnemyState.CHASE;
                } else if (this.stateTimer <= 0) {
                    this.state = EnemyState.PATROL;
                    this.subState = 'WALKING';
                    this.targetPosition = null;
                } else {
                    if (this.lastSeenPosition) {
                        if (this.position.distanceTo(this.lastSeenPosition) < 0.5) {
                            this.lastSeenPosition = null; // Arrived
                        } else {
                            this.targetPosition = this.lastSeenPosition;
                        }
                    } else {
                        // Look randomly
                        this.patrolLogic(true); 
                    }
                }
                break;

            case EnemyState.IDLE:
                // Do nothing
                break;
        }
    }

    private checkSight(player: Character): boolean {
        if (!player.mesh) return false;

        const dist = this.position.distanceTo(player.position);
        if (dist > this.sightRange) return false;

        const dirToPlayer = new THREE.Vector3().subVectors(player.position, this.position).normalize();
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
        const angle = forward.angleTo(dirToPlayer);
        
        if (THREE.MathUtils.radToDeg(angle) > this.fieldOfView / 2) return false;

        const start = this.position.clone().add(new THREE.Vector3(0, 1, 0)); 
        const end = player.position.clone().add(new THREE.Vector3(0, 1, 0));
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        
        this.raycaster.set(start, direction);
        this.raycaster.far = dist;

        const obstacles: THREE.Object3D[] = [];
        this.game.scene.traverse(obj => {
            if (obj === this.mesh || obj === player.mesh || obj.name === 'Ground') return; 
            if ((obj as THREE.Mesh).isMesh && obj.visible) {
                let p = obj.parent;
                while(p) {
                   if (p === this.mesh || p === player.mesh) return;
                   p = p.parent;
                }
                obstacles.push(obj);
            }
        });

        const intersects = this.raycaster.intersectObjects(obstacles);
        if (intersects.length > 0 && intersects[0].distance < dist - 0.5) {
            return false;
        }

        return true;
    }

    private patrolLogic(isSearch: boolean = false) {
        // Chance to switch to IDLE logic if just starting a new patrol path
        // Only if not searching
        if (!isSearch && Math.random() < 0.3) {
             this.subState = 'WAITING';
             this.waitTimer = 0;
             // Random wait time between 2s and 20s (to allow bored)
             this.stateTimer = 2 + Math.random() * 18;  
             this.targetPosition = null;
             return;
        }

        if (!this.targetPosition || this.position.distanceTo(this.targetPosition) < 0.5) {
             const range = isSearch ? 5 : 15;
             
             // Try to find a valid point 10 times, otherwise just wait
             for(let i=0; i<10; i++) {
                 const angle = Math.random() * Math.PI * 2;
                 const dist = 2 + Math.random() * range;
                 const center = isSearch ? this.position : (this.startPosition || this.position);
                 const candidate = new THREE.Vector3(
                     center.x + Math.cos(angle) * dist,
                     0,
                     center.z + Math.sin(angle) * dist
                 );

                 if (this.game.levelManager.isWalkable(candidate.x, candidate.z)) {
                     this.targetPosition = candidate;
                     this.subState = 'WALKING';
                     return;
                 }
             }
             
             // If failed to find point, just wait
             this.subState = 'WAITING';
             this.waitTimer = 0;
             this.stateTimer = 2;
        }
    }

    private updateMovement(delta: number) {
        if (!this.targetPosition || (this.subState === 'WAITING' && this.state === EnemyState.PATROL)) {
            // Already handled animation in updateState for waiting
            // but if we just have no target (e.g. searching but arrived), idle
            if (this.state !== EnemyState.PATROL || this.subState !== 'WAITING') {
                this.fadeToAction('idle', 0.2);
            }
            return;
        }

        const toTarget = new THREE.Vector3().subVectors(this.targetPosition, this.position);
        const dist = toTarget.length();

        if (dist > 0.1) {
            const isRunning = this.state === EnemyState.CHASE;
            const targetSpeed = isRunning ? this.runSpeed : this.walkSpeed;
            this.movementSpeed = THREE.MathUtils.lerp(this.movementSpeed, targetSpeed, delta * 5);
            
            toTarget.normalize();
            
            // Rotation
            const targetRot = Math.atan2(toTarget.x, toTarget.z);
            let rotDiff = targetRot - this.rotation;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            this.rotation += rotDiff * delta * 5;

            // Move
            const moveStep = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation).multiplyScalar(this.movementSpeed * delta);
            let nextPos = this.position.clone().add(moveStep);

            // Collision & Sliding
            if (this.game.levelManager.isWalkable(nextPos.x, nextPos.z)) {
                this.position.copy(nextPos);
            } else {
                // Try sliding X
                const nextPosX = this.position.clone().add(new THREE.Vector3(moveStep.x, 0, 0));
                if (this.game.levelManager.isWalkable(nextPosX.x, nextPosX.z)) {
                    this.position.copy(nextPosX);
                } else {
                    // Try sliding Z
                     const nextPosZ = this.position.clone().add(new THREE.Vector3(0, 0, moveStep.z));
                     if (this.game.levelManager.isWalkable(nextPosZ.x, nextPosZ.z)) {
                        this.position.copy(nextPosZ);
                     } else {
                         // Blocked completely - Pick new target if patrolling
                         if (this.state === EnemyState.PATROL) {
                             this.targetPosition = null; 
                         }
                     }
                }
            }

            this.fadeToAction(isRunning ? 'run' : 'walk', 0.2);
        } else {
             // Arrived
             this.targetPosition = null;
        }
    }

    private fadeToAction(name: string, duration: number) {
        if (!this.actions[name]) return;
        const nextAction = this.actions[name];
        if (this.activeAction !== nextAction) {
            if (this.activeAction) this.activeAction.fadeOut(duration);
            nextAction.reset().fadeIn(duration).play();
            this.activeAction = nextAction;
        }
    }
    
    public setPosition(pos: THREE.Vector3) {
        this.position.copy(pos);
        this.startPosition = pos.clone();
        if (this.mesh) this.mesh.position.copy(this.position).add(this.visualOffset);
    }
}
