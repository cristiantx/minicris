import * as THREE from 'three';
import { Game } from './Game';

export class CameraManager {
    public camera: THREE.OrthographicCamera;
    // private game: Game;

    // Isometric Orthographic config
    private viewSize: number = 15; // How many world units vertical fit in screen
    // Camera states
    private offset: THREE.Vector3;
    private isoOffset: THREE.Vector3 = new THREE.Vector3(10, 10, 10);
    private splashOffset: THREE.Vector3 = new THREE.Vector3(0, 3, 4); 
 // Front, offset to look at character on the right
    private currentTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    constructor(_game: Game) {
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

        this.offset = this.splashOffset.clone();
        this.camera.position.copy(this.offset);
        this.camera.lookAt(0, 1.2, 0); // Look at character chest/head height
    }

    public setView(type: 'SPLASH' | 'GAMEPLAY') {
        if (type === 'SPLASH') {
            this.viewSize = 3; // Even more zoomed in
            this.offset.copy(this.splashOffset);
        } else {
            this.viewSize = 15; // Normal zoom for gameplay
            this.offset.copy(this.isoOffset);
        }
        this.resize();
    }

    public resize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -this.viewSize * aspect / 2;
        this.camera.right = this.viewSize * aspect / 2;
        this.camera.top = this.viewSize / 2;
        this.camera.bottom = -this.viewSize / 2;
        this.camera.updateProjectionMatrix();
    }

    public follow(target: THREE.Vector3, delta: number, lerpFactor: number = 5.0) {
        this.currentTarget.lerp(target, lerpFactor * delta);
        
        const desiredPosition = this.currentTarget.clone().add(this.offset);
        this.camera.position.lerp(desiredPosition, lerpFactor * delta);
        
        // Look at point logic
        const lookTarget = this.currentTarget.clone();
        if (this.offset.equals(this.splashOffset)) {
            // Lowering the look target "pushes" the character towards the bottom of the screen frame
            lookTarget.y = 0.3; 
        }
        this.camera.lookAt(lookTarget);
    }
}
