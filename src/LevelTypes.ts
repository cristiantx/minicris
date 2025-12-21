export interface LevelMeta {
    tileSize: number;
    grid: "isometric";
    width: number;
    height: number;
}

export interface TilesetMap {
    [key: string]: string;
}

export interface LayerCell {
    x: number;
    y: number;
    tile: string;
    rot: 0 | 1 | 2 | 3;
    h?: number;
    toHeight?: number;
}

export interface Layer {
    name: string;
    z: number;
    cells: LayerCell[];
}

export interface GroundDefault {
    tile: string;
    rot: 0 | 1 | 2 | 3;
    h: number;
}

export interface LevelDefaults {
    ground: GroundDefault;
}

export interface OverrideCell {
    x: number;
    y: number;
    tile: string;
    rot?: 0 | 1 | 2 | 3;
    h?: number;
    toHeight?: number;
}

export interface LevelObject {
    id: string;
    type: string;
    x: number;
    y: number;
    h: number;
    rot?: number;
    props?: {
        [key: string]: any;
    };
}

export interface LevelData {
    meta: LevelMeta;
    tilesets: TilesetMap;
    defaults: LevelDefaults;
    overrides: OverrideCell[];
    layers: Layer[];
    objects: LevelObject[];
}
