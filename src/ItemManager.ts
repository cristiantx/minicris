import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ITEM_CONFIG, type ItemType } from './config/Items';
import type { LevelData } from './LevelTypes';
import { Game } from './Game';

interface ActiveItem {
    id: string;
    type: string;
    mesh: THREE.Group;
    light?: THREE.PointLight;
    basePosition: THREE.Vector3;
    config: ItemType;
    removed: boolean;
}

export class ItemManager {
    private game: Game;
    private loader: GLTFLoader;
    private items: ActiveItem[] = [];
    private modelCache: Record<string, THREE.Group> = {};

    constructor(game: Game) {
        this.game = game;
        this.loader = new GLTFLoader();
    }

    public async loadItems(levelData: LevelData) {
        const itemObjects = levelData.objects.filter(obj => obj.type === 'item');
        const tileSize = levelData.meta.tileSize;

        for (const obj of itemObjects) {
            const itemTypeKey = obj.props?.itemType || 'beer';
            const config = ITEM_CONFIG[itemTypeKey];
            if (!config) continue;

            const meshTemplate = await this.getOrLoadModel(config.model);
            const mesh = meshTemplate.clone();
            
            // Normalize Height and Position
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());
            if (size.y > 0) {
                const heightScale = config.height / size.y;
                mesh.scale.setScalar(heightScale * config.scale);
            } else {
                mesh.scale.setScalar(config.scale);
            }

            const position = new THREE.Vector3(
                obj.x * tileSize,
                obj.h,
                obj.y * tileSize
            );
            mesh.position.copy(position);
            mesh.rotation.x = config.tilt.x;
            mesh.rotation.z = config.tilt.z;

            this.game.scene.add(mesh);

            let light: THREE.PointLight | undefined;
            if (config.glow) {
                light = new THREE.PointLight(config.glowColor, 2, 3);
                light.position.copy(position);
                light.position.y += 0.5;
                this.game.scene.add(light);
            }

            this.items.push({
                id: obj.id,
                type: itemTypeKey,
                mesh,
                light,
                basePosition: position.clone(),
                config,
                removed: false
            });
        }
    }

    private async getOrLoadModel(modelName: string): Promise<THREE.Group> {
        if (this.modelCache[modelName]) {
            return this.modelCache[modelName];
        }

        const gltf = await this.loader.loadAsync(`/models/${modelName}`);
        const model = gltf.scene;
        
        // Center pivot and cleanup
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        const wrapper = new THREE.Group();
        wrapper.add(model);
        
        model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.modelCache[modelName] = wrapper;
        return wrapper;
    }

    public update(dt: number, playerPosition: THREE.Vector3) {
        const time = performance.now() * 0.001;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (item.removed) continue;

            // Animations
            // Rotation
            item.mesh.rotation.y += item.config.rotationSpeed * dt;
            
            // Floating
            const floatOffset = Math.sin(time * item.config.floatSpeed) * item.config.floatAmplitude;
            item.mesh.position.y = item.basePosition.y + floatOffset;
            if (item.light) {
                item.light.position.y = item.basePosition.y + floatOffset + 0.5;
                // Pulsing glow
                item.light.intensity = 2 + Math.sin(time * 3) * 1;
            }

            // Collision Detection (Simple Radius)
            const dist = playerPosition.distanceTo(item.mesh.position);
            if (dist < 1.1) {
                this.collectItem(item);
            }
        }
    }

    private collectItem(item: ActiveItem) {
        item.removed = true;
        
        // Visual Effect: Scale down and disappear
        const duration = 0.3;
        const startTime = performance.now() * 0.001;
        const initialScale = item.mesh.scale.x;

        // Use performance.now delta
        let lastTime = startTime;
        const animateWithDelta = () => {
            const now = performance.now() * 0.001;
            const delta = now - lastTime;
            lastTime = now;
            
            const progress = (now - startTime) / duration;
            
            if (progress >= 1.0) {
                this.game.scene.remove(item.mesh);
                if (item.light) this.game.scene.remove(item.light);
                const index = this.items.indexOf(item);
                if (index > -1) this.items.splice(index, 1);
                return;
            }

            const scale = initialScale * (1.0 - progress);
            item.mesh.scale.setScalar(scale);
            if (item.light) item.light.intensity *= (1.0 - progress);
            
            item.mesh.position.y += 5 * delta; // Float up fast
            
            requestAnimationFrame(animateWithDelta);
        };

        animateWithDelta();
    }
}
