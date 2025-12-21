import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LevelData, TilesetMap } from './LevelTypes';

export class LevelManager {
    public levelData: LevelData | null = null;
    private scene: THREE.Scene;
    private loader: GLTFLoader;
    private models: { [key: string]: THREE.Group } = {}; // Cache for loaded GLBs
    private modelSizes: { [key: string]: THREE.Vector3 } = {}; // Cache for model sizes

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
    }

    public async loadLevel(url: string): Promise<void> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load level: ${response.statusText}`);
            this.levelData = await response.json();
            
            if (this.levelData) {
                await this.preloadAssets(this.levelData.tilesets);
                this.buildLevel();
            }
        } catch (error) {
            console.error("Error loading level:", error);
        }
    }

    private async preloadAssets(tilesets: TilesetMap) {
        const promises: Promise<void>[] = [];
        const loadedKeys = new Set<string>();

        Object.values(tilesets).forEach(modelName => {
            if (modelName.startsWith('primitive:')) return; // Skip primitives
            if (loadedKeys.has(modelName)) return; // Skip duplicates
            
            loadedKeys.add(modelName);
            promises.push(new Promise(async (resolve) => {
                try {
                    const gltf = await this.loader.loadAsync(`/models/${modelName}.glb`);
                    // wrapper to center pivot if needed, similar to Game.ts logic
                    const wrapper = new THREE.Group();
                    const model = gltf.scene;

                    // Normalize Scale and Pivot (Simplified logic from Game.ts)
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    
                    // Basic scaling logic based on type could go here if needed
                    // For now keeping it simple or relying on assets being reasonably sized
                    // But rocks/trees might need scaling as before.
                    
                    // Simple hacky scale for existing assets based on name
                    if (modelName.includes('rock')) {
                        const targetHeight = 0.75;
                        if (size.y > 0) model.scale.setScalar(targetHeight / size.y);
                    } else if (modelName.includes('tree')) {
                         const targetHeight = 6.0;
                         if (size.y > 0) model.scale.setScalar(targetHeight / size.y);
                    }

                    // Fix pivot to bottom
                    const finalBox = new THREE.Box3().setFromObject(model);
                    const finalSize = finalBox.getSize(new THREE.Vector3());
                    model.position.y = -finalBox.min.y;
                    
                    model.traverse((c) => {
                        if ((c as THREE.Mesh).isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                    });

                    wrapper.add(model);
                    this.models[modelName] = wrapper;
                    this.modelSizes[modelName] = finalSize; // Store final scaled size
                    resolve();
                } catch (e) {
                    console.error(`Failed to load model asset: ${modelName}`, e);
                    resolve(); // Resolve anyway to not block level load
                }
            }));
        });

        await Promise.all(promises);
    }

    private buildLevel() {
        if (!this.levelData) return;
        const { meta, tilesets, layers, defaults, overrides } = this.levelData;
        const tileSize = meta.tileSize;
        
        // 1. Spawn Default Ground + Overrides
        for (let x_grid = 0; x_grid < meta.width; x_grid++) {
            for (let y_grid = 0; y_grid < meta.height; y_grid++) {
                // Check if this cell is overridden
                const override = overrides.find(o => o.x === x_grid && o.y === y_grid);
                
                const x = x_grid * tileSize;
                const z = y_grid * tileSize;
                
                if (override) {
                    const modelKey = tilesets[override.tile];
                    if (modelKey) {
                        this.spawnTile(override.tile, modelKey, x, (override.h || 0) * 1, z, tileSize, override.rot || 0);
                    }
                } else {
                    const modelKey = tilesets[defaults.ground.tile];
                    if (modelKey) {
                        this.spawnTile(defaults.ground.tile, modelKey, x, defaults.ground.h * 1, z, tileSize, defaults.ground.rot);
                    }
                }
            }
        }

        // 2. Spawn Layers (Other structures)
        layers.forEach(layer => {
            layer.cells.forEach(cell => {
                const x = cell.x * tileSize;
                const z = cell.y * tileSize; 
                const h = (cell.h || 0) + layer.z; 
                const y = h * 1; 

                const modelKey = tilesets[cell.tile];
                
                if (modelKey) {
                    this.spawnTile(cell.tile, modelKey, x, y, z, tileSize, cell.rot);
                }
            });
        });
    }

    private spawnTile(tileId: string, key: string, x: number, y: number, z: number, size: number, rot: number) {
        let object: THREE.Object3D | null = null;

        if (key.startsWith('primitive:')) {
            const type = key.split(':')[1];
            if (type === 'box') {
                const geometry = new THREE.BoxGeometry(size, size, size); 
                
                const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
                
                // Logic based on tile type
                let yOffset = size / 2; // Default: sit ON grid (bottom at y)
                
                if (tileId.includes('floor')) {
                    material.color.setHex(0x55aa55); // Green
                    yOffset = -size / 2; // Floor: sit BELOW grid (top at y)
                }

                object = new THREE.Mesh(geometry, material);
                object.castShadow = true;
                object.receiveShadow = true;
                
                object.position.set(x, y + yOffset, z);
                
                // If it's a floor (y=0 usually), we might want it flat?
                // For now, full block logic.

            }
        } else {
            // GLB
            const template = this.models[key];
            if (template) {
                object = template.clone();
                // Position
                let yOffset = 0;
                if (tileId.includes('floor')) {
                    const size = this.modelSizes[key];
                    if (size) yOffset = -size.y;
                }
                object.position.set(x, y + yOffset, z);
            }
        }

        if (object) {
            // Rotation 0,1,2,3 -> 0, 90, 180, 270 degrees
            object.rotation.y = -rot * (Math.PI / 2); // Negative for standard rotation direction?
            this.scene.add(object);
        }
    }

    public isWalkable(x: number, z: number): boolean {
        if (!this.levelData) return true;

        const { width, height, tileSize } = this.levelData.meta;
        const gridX = Math.round(x / tileSize);
        const gridY = Math.round(z / tileSize);

        if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) {
            return false; 
        }

        // 1. Check Overrides
        const override = this.levelData.overrides.find(o => o.x === gridX && o.y === gridY);
        if (override) {
            if (!override.tile.includes('floor')) return false;
        } else {
            // 2. Check Defaults
            const defaultTile = this.levelData.defaults.ground.tile;
            if (!defaultTile.includes('floor')) return false;
        }

        // 3. Check Other Layers
        for (const layer of this.levelData.layers) {
            const cell = layer.cells.find(c => c.x === gridX && c.y === gridY);
            if (cell) {
                if (!cell.tile.includes('floor')) {
                    return false;
                }
            }
        }

        return true;
    }

    public getPlayerSpawn(): THREE.Vector3 {
        if (this.levelData) {
            const spawnObj = this.levelData.objects.find(o => o.type === 'spawn');
            if (spawnObj) {
                const { tileSize } = this.levelData.meta;
                return new THREE.Vector3(spawnObj.x * tileSize, spawnObj.h, spawnObj.y * tileSize);
            }
        }
        return new THREE.Vector3(0, 0, 0);
    }
}
