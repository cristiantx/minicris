import * as THREE from 'three';
import { Game } from './Game';

export class CameraManager {
    public camera: THREE.OrthographicCamera;
    // private game: Game;

    // Isometric Orthographic config
    private viewSize: number = 15; // How many world units vertical fit in screen
    private offset: THREE.Vector3;

    constructor(_game: Game) {
        // this.game = game;
        
        const aspect = window.innerWidth / window.innerHeight;
        
        // Orthographic camera for isometric look
        this.camera = new THREE.OrthographicCamera(
            -this.viewSize * aspect / 2,
            this.viewSize * aspect / 2,
            this.viewSize / 2,
            -this.viewSize / 2,
            0.1,
            1000
        );

        // Isometric setup
        // Ideally we want to look from a corner.
        // position x=1, y=1, z=1 normalized gives standard iso view
        this.offset = new THREE.Vector3(10, 10, 10);
        this.camera.position.copy(this.offset);
        this.camera.lookAt(0, 0, 0);
    }

    public resize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -this.viewSize * aspect / 2;
        this.camera.right = this.viewSize * aspect / 2;
        this.camera.top = this.viewSize / 2;
        this.camera.bottom = -this.viewSize / 2;
        this.camera.updateProjectionMatrix();
    }

    public follow(target: THREE.Vector3, delta: number) {
        // Smoothly interpolate to target position + offset
        const desiredPosition = target.clone().add(this.offset);
        // Simple lerp for smoothness (adjust factor 5.0 for speed)
        this.camera.position.lerp(desiredPosition, 5.0 * delta);
        this.camera.lookAt(target);
    }
}
