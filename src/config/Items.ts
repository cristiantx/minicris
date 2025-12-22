export interface ItemType {
    model: string;
    scale: number;
    height: number;
    rotationSpeed: number;
    floatSpeed: number;
    floatAmplitude: number;
    tilt: { x: number; y: number; z: number };
    glow: boolean;
    glowColor: number;
}

export const ITEM_CONFIG: Record<string, ItemType> = {
    beer: {
        model: 'beer.glb',
        scale: 1.0,
        height: 0.8,
        rotationSpeed: 1.5,
        floatSpeed: 2.0,
        floatAmplitude: 0.1,
        tilt: { x: 0.3, y: 0, z: 0 },
        glow: true,
        glowColor: 0xffaa00
    }
};
